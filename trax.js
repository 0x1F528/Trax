/********************************************************************************************************************
    Trax reactive programming library

    Quick:  let t1 = trax(1);                       // new trax instance
            t1.id('t1');                            // optional identifier to debugging/logging easier
            let t2 = trax(2);                       // new trax instance
            t2.id('t2');                            // optional identifier to debugging/logging easier
            let c1 = trax(t1,t2);                   // new trax instance to compose t1 and t2
            c1.fct( (x,y) => x+y )                  // define how the t1 and t2 instances are to be composed
            c1.onChange( x => console.log(x) )      // what to do when t1 or t2 (or c1) changes
            t1.fire()                               // fire an update event on t1 even though it hasn't changed

            t1.subs()                               // return JSON showing all the trax nodes dependent on t1
            c1.pubs()                               // return JSON showing all the trax nodes c1 depends on
            t1.log( (x) => console.log(x) )         // optional logging function

********************************************************************************************************************/


class Trax extends Function {                                           // Trax is a function with behavior added
    constructor(fn) {
        const self = (...args) => {
            return fn(...args);
        
        }
        self._pubs = [];                                                // no publishers at construction time
        self._subs = new Set();                                         // starts off with no dependent(child) trax instances
        self._phase = Trax.PHASE.INITIAL;                               //    and initial phase
        self.value = undefined;                                         //    and unknown value
    
        Object.setPrototypeOf(self, Trax.prototype);                    // so that instanceof Trax will work
        Trax.prototype.valueOf = function () {                          // implement valueOf
            return this();
        };
        return self;
    }

    /* Trax level constants */
    static HALT = Symbol("halt");                                       // special symbol to indicate that a current computation should not propagate (-> filter)
    static UPDATE = Symbol("update");                                   // standard bahavior when change detected
    static PROCESS = {                                                  // flag to maintain the context of the current processing traveral
        OUTER       : Symbol("outer"),                                  // this is the outer most call; it will return the current value in all cases
        INNER       : Symbol("inner"),                                  // this is a lower level call; HALTed value will bubble short-circuiting any updates (ignore HALTed events)
        REFRESH     : Symbol("refresh"),                                // this is a call to auto-refresh the dependencies when setting onChange
        UPDATE      : Symbol("update")                                  // this is an update call that will update the dependencies
    };
    static PHASE = {                                                    // phases or processing state within a trax element
        INITIAL     : Symbol("initial"),                                // trax node just initialized
        INVALIDATED : Symbol("invalidated"),                            // trax node cache is invalid and will need to be recalculated
        INPROCESS   : Symbol("inprocess"),                              // traversing the tree of nodes; this allows us to avoid looping when there are cycles in the graph
        CACHED      : Symbol("cached")                                  // trax node cache is valid
    };
    static MODE = {                                                     // trax supports two modes for active (onChange()) nodes
        ASYNC       : Symbol("async"),                                  // async: updates will be batched and then only evaluated during the next event loop
        SYNC        : Symbol("sync")                                    // sync: updates will be processed inline; this means that onChange could be called multiple times in rapid succession
    };
    
    /* Trax level behaviors */
    static _changeMode = Trax.MODE.SYNC;                                // default to SYNC processing of active nodes
    static onChange = (mode) => Trax._changeMode = mode;                // fct to set the processing mode
    static _logger = false;                                             // Trax level logging is off by default
    static log = (fct = false) => Trax._logger = fct;                   // set a Trax level logging function (or turn off)
    static isTrax = (e) => e instanceof Trax;                           // is this a Trax instance?
    static _activeElems = new Set();                                    // this is where we store the active nodes that will responde to UPDATE events

    static _trigger = () => {                                           // evaluate all activeElems; these are added for subscribers handling onChange()
        switch (Trax._changeMode) {                                     // can either evaluate right now (SYNC), or ASYNC to possibly batch additional activeElems
            case Trax.MODE.ASYNC:
                if (!Trax._timeoutID) {                                 // only one ASYNC queue at a time
                    Trax._timeoutID = setTimeout(
                        Trax._evalActiveElements, 0                     // 0 timeout => will be executed at the next event loop
                    );
                }
                break;
            case Trax.MODE.SYNC:
                Trax._evalActiveElements();                             // trigger right now what we've got
                break;
        }
    };
    static _evalActiveElements = () => {                                // do the actual evaluation of the active elements
        Trax._activeElems.forEach((e) => {
            e(Trax.PROCESS.INNER);                                      // evaluate element (-> for active side effects); will call any onChange handlers
        });
        Trax._activeElems.clear();                                      // empty the set
        Trax._timeoutID = undefined;                                    // for the ASYNC case so that a new timeout can be set up
    };

    /* Handle pub/sub relationship */
    register(newPubs) {  
        this.deregister();                                              // deregister from any previous trax publishers
        this._pubs = newPubs;                                           // let all its trax publishers know about this new subscriber
        for (var e of this._pubs) {                                     // _subs is used to store dependent elements (child nodes)
            if (Trax.isTrax(e)) e._subs.add(this);                      // skip non-trax "publishers"
        }
        return this._notify(Trax.UPDATE);                               // notify dependents of change (this will recursively go all the way through the dependency tree, adding active elements to the activeElems list)
    };
    deregister(recursive) {                                             // let all trax publishers know that the subscriber is leaving
        for (var e of this._pubs) {                                     // remove from the _pubs' _subs list
            if (Trax.isTrax(e)) {                                       // skip non-trax "publishers"
                e._subs.delete(this);                                   // no longer a subscriber
                if (recursive && !e._subs.size)                         // if recursive and has no subscribers left
                    e.deregister(recursive);                            // deregister this element as well
            }
        }
        this._pubs = [];                                                // so no more publishers
        this._phase = Trax.PHASE.INITIAL;                               // initial phase
        this.value = undefined;                                         // unknown value
        return this;                                                    // --> fluent behavior
    };
    prune() {
        this.deregister(true);
        for (var e of this._subs) {                                     // remove from _subs
            e.prune();
        }
        return this;                                                    // --> fluent behavior
    }
    
    /* Handle update events through the trax node tree */
    _notify(event, arg) {                                               // notify _subs of s that it has changed
        if (this._phase === Trax.PHASE.INVALIDATED ||                   // no active children (we can infer this because active children would have cached values); stop here
            this._phase === Trax.PHASE.INPROCESS) return;               // we've already seen this element (cyclical graph); stop here
        if (event === Trax.UPDATE) {                                    // standard Flow: a publisher has been updated and all subscribers are being notified
            this._phase = Trax.PHASE.INVALIDATED;                       // cache marked obsolete
        } else {                                                        // alternate Flow: an event has been fire()d and this event will be propagated to subscribers recursively
            let name = (typeof event === 'symbol') ? event.description : event;
            if (typeof this[name] === 'function') {                     // if there is a function that matches the event, ...
                let res = this[name](this.value, this, arg);            // call it as trax.event(current-value, this-trax, event-arg)
                if (res === Trax.HALT) return;                          // don't go further if Trax.HALT
                if (res !== undefined) arg = res;                       // any returned response will be passed up the chain
            } 
        }
        if (this.onChange && this.onChange())                           // if there is a captured onchange function, ...
            Trax._activeElems.add(this);                                // add self to active list
        for (var e of this._subs) {
            e._notify(event,arg);                                       // recursively notify all dependents; concat notify response
        }
        Trax._trigger();                                                // evaluate all active/onChange elements to respond to the change
        return this;
    };
    _suppressUpdate( processLevel) {                                    // either return the current value (if OUTER), or bubble back the HALT event
        this._phase = Trax.PHASE.CACHED;                                // hide the parent event and accept the current value as valid cache
        return (processLevel === Trax.PROCESS.OUTER) ?                  // if top level call ...
            this.value : Trax.HALT;                                     // return current value ELSE bubble up the HALT so the _subs will also ignore the event/update
    }

    /* Handle getting the value */
    _evaluateValue(fct, values, processLevel) {                         // what is the value of t?
        values.push(this.value,this);                                   // additionally pass in current value and "this"
        var res = this._logger(this.value, fct().apply(this,values));   // evaluate the function against the captured params and return (and maybe log new value)
    
        if (res === Trax.HALT) return Trax.HALT;                        // bubble out the suppression of the change/value
        
        this.value = res;                                               // this is the value
        var onChange;                                                   // if the onChange parameter is a function
        if (processLevel !== Trax.PROCESS.REFRESH && this.onChange && (onChange = this.onChange()) && onChange instanceof Function ) {
            onChange.call(this, this.value, this);                      //    ... call it to notify of change (this, value, this)
        }
        return res;
    }
    
        
    /* Event handling methodes: */
    handler(name, fct) {                                                // add a function with "name" 
        this[name.description || name] = fct;                           // to handle events of type "name"
        return this;
    }
    fire(event = Trax.UPDATE, ...arg) {                                 // propagate an event through the dependency tree; default is UPDATE with no args (could be used to handle mouse clicks, for example)
        return this._notify(event, ...arg);                             // notify the dependency tree that a "change" has happened
    };                                                      

    /* Trouble shooting support methodes: */
    _logger(from, to) {                                                 // log the UPDATE event
        if (this.id && this.id()) {                                     // we will may the logging function if there is an ID on this trax element
            if (this.log())                                             // element level log function
                this.log()('Update to ' + this.id() + ': ' + from?.toString() + ' => ' + to?.toString());
            else if (Trax._logger)                                      // Trax level log function
                Trax._logger()('Update to ' + this.id() + ': ' + from?.toString() + ' => ' + to?.toString());
        }
        return to;
    };

    pubs(levels, visited = []) {                                        // recursively output the publishers for this element (at most levels count deep)
        if (visited.includes(this)) return this._dump(',"<--":"CYCLE"');
        var p = [];                                                     // collect all the publisher details
        if (levels === undefined || levels--) {
            for (var e of this._pubs) {
                p.push((Trax.isTrax(e))? e.pubs(levels, visited) : e);  // recursively get the publishers of these publishers
            }
        }
        return this._dump(',"<--":[' + p.join(',') + ']');
    };
    
    _dump(refs) {                                                       // output details for a trax element; refs will be appended
        return `{"value":"${this.value}","id":"${this.id()}","phase":"${this._phase.toString()}"${refs}}`;
    }
    
    subs(levels, visited = []) {                                        // recursively output the subscribers to this element (at most levels count deep)
        if (visited.includes(this)) return this._dump(',"<--":"CYCLE"');
        var s = [];                                                     // collect all the subscriber details
        if (levels === undefined || levels--) {
            for (var e of this._subs) {
                s.push((Trax.isTrax(e))? e.subs(levels, visited) : e);  // recursively get the subscribers of these subscribers
            }
        }
        return this._dump(',"-->":[' + s.join(',') + ']');
    };
    
}

var capture = (fct, ...a) => {                                          // close a function around a list of params

    var extractParams = (args) => {                                     // three main use cases: 
        if (args.length) {
            if (typeof args[0] === 'symbol') {                          // a) first arg is a symbol => we are recursively traversing the node tree
                return [args[0]];                                       //    return the PROCESS level
            }
            return [Trax.PROCESS.UPDATE, args];                         // b) args passed in => this trax node is being updated
        }
        return [Trax.PROCESS.OUTER];                                    // c) no args => top level call to get the value of this trax node
    }
    
    var T = new Trax((...b) => {                                        // this is the new Trax function with getter: a() and setter: a(1,23) semantics

        var [processLevel, args] = extractParams(b);                    // tease out the process level and args

        if (processLevel === Trax.PROCESS.UPDATE)                       // this node is being updated
            return T.register(args);                                    // update the list of publishers to this trax subscriber and notify the subscriber tree of the change; RETURN

        if (T._phase === Trax.PHASE.INPROCESS ||                        // we've already seen this node before
            T._phase === Trax.PHASE.CACHED) return T.value;             // or we already have a valid value --> short circuit and use the cached value

        var values = T._pubs.map(                                       // get the (publisher) values this node depends on
            (e) => (Trax.isTrax(e)) ? e(Trax.PROCESS.INNER) : e         // if is trax recursively ask for its value; else simply return the parameter
        );

        if (values.includes(Trax.HALT))                                 // one of the values is the suppression indicator; we'll pretend nothing happened; suppress any side effects
            return T._suppressUpdate(processLevel);                      // don't evaluate and use existing cached/current value; RETURN

        T._phase = Trax.PHASE.INPROCESS;                                // processing
        var res = T._evaluateValue(fct,values,processLevel);            // calculate the value fct(values)
        T._phase = Trax.PHASE.CACHED;                                   // cached
        return res;
    });
    T.register(a);                                                      // register any trax instances in the list of params
    return T;
};


var trax = (...a) => {                                                  // generate a trax instance

    const identf = (x) => x;                                            // identity function

    var fluent_attr = (T, t, onSet) => {                                // generate a fluent function from a getter/setter fct
        return (a) => {
            if (a === undefined) return t();                            // --> return the getter value 
            t(a);                                                       // set the value
            if (onSet) onSet(a);
            return T;                                                   // return the "base" object making the behavior fluent
        };
    };

    // fct, id, onChange, log are all trax instances themselves; declaring and initializing them here to avoid infinite recursion during object construction
    
    var fct     = capture (() => identf, identf);                       // default to identity function
    var T       = capture (fct         ,  ...a );                       // this is our trax instance

    T.fct       = fluent_attr (T       , fct   );                       // add the .fct attribute to the instance

    var id      = capture (() => identf, ''    );                       // default instance id to empty string
    T.id        = fluent_attr (T       , id    );                       // add the .id attribute to the instance

    var onChange= capture (() => identf, false );                       // default trax instances are not active
    var autoRefresh = (x) => {if (x) T(Trax.PROCESS.REFRESH);};         // when setting to truthy value, recursively refresh the dependency tree by evaluating this element
    T.onChange  = fluent_attr (T      , onChange, autoRefresh);         // add the .onChange attribute to the instance; this can be a function!

    var log     = capture (() => identf, false);                        // default trax instances are not logging
    T.log       = fluent_attr (T       , log  );                        // add the .log attribute to trax

    return T;
};


export { trax, Trax }

