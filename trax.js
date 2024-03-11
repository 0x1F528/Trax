const SUPPRESSED = Symbol("suppressed");                    // special symbol to indicate that a current computation should not propagate (-> filter)
const PROCESS = {
    OUTER       : Symbol("outer"),                          // this is the outer most call; it will return the current value in all cases
    INNER       : Symbol("inner"),                          // this is a lower level call; SUPPRESSED value will bubbling short-circuiting any updates (ignore SUPPRESSED events)
    REFRESH     : Symbol("refresh"),                        // this is a call to refresh the dependencies after setting onChange
    UPDATE      : Symbol("update")                          // this is an update call that will update the dependencies
}
const PHASE = {                                             // phases or processing state within a trax element
    UNKNOWN     : Symbol("unknown"),
    INVALIDATED : Symbol("invalidated"),
    INPROCESS   : Symbol("inprocess"),
    CACHED      : Symbol("cached")
}

var isTrax = (e) => e instanceof Trax;                      // is this a Trax instance?

var register = (S) => {                                     // let all trax publishers know about "S"
    for (var e of S._pubs) {                                // _subs is used to store dependent elements (child nodes)
        if (isTrax(e)) e._subs.add(S);
    }
};
var deregister = (S) => {                                   // let all trax publishers know that "S" is leaving
    for (var e of S._pubs) {                                // remove from _subs
        if (isTrax(e)) e._subs.delete(S);
    }
};

var notify = (s) => {                                       // notify _subs of s that it has changed
    if (s._phase === PHASE.INVALIDATED || 
        s._phase === PHASE.INPROCESS) return [];            // no active children (we can infer this because active children would have cached values); stop here
    s._phase = PHASE.INVALIDATED;                           // cache marked obsolete
    return Array.from(s._subs).reduce(                      // return list of active elements
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

var dump = (S,refs) => {                                    // output details for a trax element; refs will be appended
    return `{"value":"${S.value}","id":"${S.id()}","phase":"${S._phase.toString()}"${refs}}`;
}

var pubs = (S, l) => {                                      // recursively output the publishers for this element (at most l levels deep)
    var p = [];                                             // collect all the publisher details
    if (l === undefined || l--) {
        for (var e of S._pubs) {
            p.push((isTrax(e))? pubs(e,l) : e);             // recursively get the publishers of these publishers
        }
    }
    return dump(S,',"<--":[' + p.join(',') + ']');
};

var subs = (S, l) => {                                      // recursively output the subscribers to this element (at most l levels out)
    var s = [];                                             // collect all the subscriber details
    if (l === undefined || l--) {
        for (var e of S._subs) {
            s.push((isTrax(e))? subs(e,l) : e);             // recursively get the subscribers of these subscribers
        }
    }
    return dump(S,',"-->":[' + s.join(',') + ']');
};

var updatePubs = (S, newPubs) => {
    deregister(S)                                           // deregister from any trax publishers
    S._pubs = newPubs;                                      // replace the list of (closure) params
    register(S)                                             // register with trax publishers
    S._phase = PHASE.UNKNOWN;                               //      AND unknown value
    S.value = undefined;
    trigger ( notify(S) )                                   // notify dependents of change and fire (evaluate) all active elements
    return S;                                               // --> fluent behavior
}

var suppressUpdate = (S,recursionFlag) => {
    S._phase = PHASE.CACHED;                                // hide the parent event and accept the current value as valid cache
    return (recursionFlag === PROCESS.OUTER) ?              // if top level call 
        S.value : SUPPRESSED;                               //      return current value ELSE bubble up the SUPPRESSED so the _subs will also ignore the event/update
}

var evaluateValue = (S,fct,values,recursionFlag) => {
    values.push(S.value,S);                                 // additionally pass in current value and "this"
    var res = logger(S, S.value, fct().apply(S,values));    // evaluate the function against the captured params and return (and maybe log new value)

    if (res === SUPPRESSED) return SUPPRESSED;              // bubble out the suppression of the change/value
    
    S.value = res;
    var onChange;                                           // if the onChange parameter is a function
    if (recursionFlag !== PROCESS.REFRESH && S.onChange && (onChange = S.onChange()) && onChange instanceof Function ) {
        onChange.call(S, S.value, S);                       //    ... call it to notify of change
    }
    return res;
}

var capture = (fct, ...a) => {                              // close a function around a list of params
    var S = new Trax((...b) => {                            // this is the new function with getter/setter semantics

        var recursionFlag = PROCESS.OUTER;                  // determine the processing mode; default to top level call
        if (b.length) {                                     // either updating the publishers or passing in a PROCESS flag
            recursionFlag = (typeof b[0] === 'symbol') ? 
                b[0] : PROCESS.UPDATE;
        }

        if (recursionFlag === PROCESS.UPDATE) 
            return updatePubs(S, b);                        // update the list of publishers to this trax subscriber

        if (S._phase === PHASE.INPROCESS ||
            S._phase === PHASE.CACHED) return S.value;      // --> short circuit if in process or cached

        var values = S._pubs.map(
            (e) => (isTrax(e)) ? e(PROCESS.INNER) : e       // get all the publisher values this subscriber depends on
        );

        if (values.includes(SUPPRESSED))                    // had an suppressed indicator (don't evaluate and use existing cached/current value)
            return suppressUpdate(S,recursionFlag);

        S._phase = PHASE.INPROCESS;                         // processing
        var res = evaluateValue(S,fct,values,recursionFlag);// recursively calculate this value
        S._phase = PHASE.CACHED;                            // cached
        return res;
    });
    S._pubs = a;                                            // set the publishers for this subscriber
    register(S)                                             // register any trax instances in the list of params
    return S;
};

class Trax extends Function {
    constructor(fn) {
        const self = (...args) => {
            return fn(...args);
        }
        self._subs = new Set();                             // starts off with no dependent(child) trax instances
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
    var autoRefresh = (x) => {if (x) S(PROCESS.REFRESH);};  // when setting to truthy value, recursively refresh the dependency tree by evaluating this element
    S.onChange  = fluent_attr ( S      , onChange, autoRefresh); // add the .onChange attribute to the instance

    var log     = capture (() => identf, identf);           // default trax instances are not logging
    S.log       = fluent_attr (S       , log   );           // add the .log attribute to trax

    S.fire      = () => trigger ( notify(S) );              // kick all the deps with a notification

    S.pubs      = (levels) => pubs(S, levels);              // For Troubleshooting: recursively visit all publishers for S (levels deep)
    S.subs      = (levels) => subs(S, levels);              // For Troubleshooting: recursively visit all subscribers to S (levels deep)

    return S;
};

trax.SUPPRESSED= SUPPRESSED;                                // Response flag to indicate that the value is filtered/suppressed


export { trax, Trax }

