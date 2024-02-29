const SUPPRESSED = Symbol("suppressed");                    // special symbol to indicate that a current computation should not propagate (-> filter)
const PROCESS = {
    OUTER       : Symbol("top"),                            // this is the outer most call; it will return the current value in all cases
    INNER       : Symbol("inner"),                          // this is a lower level call; SUPPRESSED value will bubbling short-circuiting any updates (ignore SUPPRESSED events)
    UPDATE      : Symbol("update")                          // this is an update call that will update the dependencies
}
const PHASE = {                                             // phases or processing state within a trax element
    UNKNOWN     : Symbol("unknown"),
    INVALIDATED : Symbol("invalidated"),
    INPROCESS   : Symbol("inprocess"),
    CACHED      : Symbol("cached")
}

var isTrax = (e) => e instanceof Trax;                      // is this a Trax instance?

var register = (S,a) => {                                   // let all trax instances of "a" know about "S"
    for (var e of a) {                                      // _deps is used to store dependent elements (child nodes)
        if (isTrax(e)) e._deps.add(S);
    }
};
var deregister = (S,a) => {                                 // let all trax instances of "a" know that "S" is leaving
    for (var e of a) {                                      // remove from _deps
        if (isTrax(e)) e._deps.delete(S);
    }
};

var notify = (s) => {                                       // notify _deps of s that it has changed
    if (s._phase === PHASE.INVALIDATED || 
        s._phase === PHASE.INPROCESS) return [];            // no active children (we can infer this because active children would have cached values); stop here
    s._phase = PHASE.INVALIDATED;                           // cache marked obsolete
    return Array.from(s._deps).reduce(                      // return list of active elements
        (active, e) => active.concat(notify(e))             // recursively notify all dependents; concat notify response
    ,   (s.onChange && s.onChange()) ? [s] : []             // include self or not?
    );
};

var trigger = (activeElems) => {
    for (var e of activeElems) {
        e(PROCESS.INNER);                                   // evaluate element (-> for active side effects)
    };
};

var logger = (s, from, to) => {
    if (s.id && s.id()) {                                   // we will call the logging function if there is an ID on this trax element
        s.log()('Update to ' + s.id() + ': ' + from + ' => ' + to);
    }
    return to;
};

var capture = (fct, ...a) => {                              // close a function around a list of params
    var S = new Trax((...b) => {                            // this is the new function with getter/setter semantics

        var recursionFlag = PROCESS.OUTER;                  // determine the processing mode
        if (b.length) {
            recursionFlag = PROCESS.UPDATE
            if (b[0] == PROCESS.INNER) recursionFlag = PROCESS.INNER;
        }

        if (recursionFlag === PROCESS.UPDATE) {
            deregister(S,a)                                 // deregister any trax instances
            a = b;                                          // replace the list of (closure) params
            register(S,a)                                   // register any trax instances in the new list of params
            S._phase = PHASE.UNKNOWN;                       //      AND unknown value
            S.value = undefined;
            trigger ( notify(S) )                           // notify dependents of change and fire (evaluate) all active elements
            return S;                                       // --> fluent behavior
        } // ELSE

        if (S._phase === PHASE.INPROCESS ||
            S._phase === PHASE.CACHED) return S.value;      // --> short circuit if in process or cached

        var p = a.map(
            (e) => (isTrax(e)) ? e(PROCESS.INNER) : e       // get all the values this depends on
        );
        if (p.includes(SUPPRESSED)) {                       // had an suppressed indicator (don't evaluate and use existing cached/current value)
            S._phase = PHASE.CACHED;                        // hide the parent event and accept the current value as valid cache
            if (recursionFlag === PROCESS.OUTER) return S.value; // if top level call return current value
            return SUPPRESSED;                              // ELSE bubble up the SUPPRESSED so the _deps will also ignore the event/update
        }

        S._phase = PHASE.INPROCESS;                         // processing
        p.push(S.value,S);                                  // additionally pass in current value and "this"
        var res = logger(S, S.value, fct().apply(S,p));     // evaluate the function against the captured params and return (and maybe log new value)
        if (res !== SUPPRESSED) {
            S.value = res;
            var notification;
            if (S.onChange && (notification = S.onChange()) && notification instanceof Function ) {
                notification.call(S, S.value, S);
            }
        }

        S._phase = PHASE.CACHED;                            // cached
        return res;
    });
    register(S,a)                                           // register any trax instances in the list of params
    return S;
};

class Trax extends Function {
    constructor(fn) {
        const self = (...args) => {
            return fn(...args);
        }
        self._deps = new Set();                             // starts off with no dependent(child) trax instances
        self._phase = PHASE.UNKNOWN;                        //    and unknown value
        self.value = undefined;

        Object.setPrototypeOf(self, Trax.prototype);        // so that instanceof Trax will work
        Trax.prototype.valueOf = function () {              // implement valueOf
            return this();
        };
        return self;
    }
}


var trax = (...a) => {                                      // generate a trax instance

    const identf = (x) => x;                                // identity function

    var fluent_attr = (S, s, onSet) => {                    // generate a fluent function from a getter/setter fct
        return (a) => {
            if (a === undefined) return s();                // --> return the getter value 
            s(a);                                           // set the value
            if (onSet) onSet(a);
            return S;                                       // return the "base" object making the behavior fluent
        };
    };
    
    var fct     = capture (() => identf, identf);           // default to identity function
    var S       = capture (fct         ,  ...a );           // this is our trax instance

    S.fct       = fluent_attr (S       , fct   );           // add the .fct attribute to the instance

    var id      = capture (() => identf, ''    );           // default instance id to empty string
    S.id        = fluent_attr (S       , id    );           // add the .id attribute to the instance

    var onChange= capture (() => identf, false );           // default trax instances are not active
    var autoRefresh = (x) => {if (x) S();};                 // when setting to truthy value, recursively refresh the dependency tree by evaluating this element
    S.onChange  = fluent_attr ( S      , onChange, autoRefresh); // add the .onChange attribute to the instance

    var log     = capture (() => identf, identf);           // default trax instances are not logging
    S.log       = fluent_attr (S       , log   );           // add the .log attribute to trax

    S.fire      = () => trigger ( notify(S) );              // kick all the deps with a notification

    return S;
};

trax.SUPPRESSED= SUPPRESSED;                                // Response flag to indicate that the value is filtered/suppressed


export { trax, Trax }

