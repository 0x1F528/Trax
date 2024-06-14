/********************************************************************************************************************
    Trax utility functions

********************************************************************************************************************/

import { trax } from './trax.js';

export var APPLY = (observed, fct) => {                                 // create a trax node that applies some function over an observed element
    return trax(observed, fct).fct( (o, f) => f(o) );
};
export var IF = (criteria, yes, no) => {                                // create a trax node that returns the yes or no value depending on criteria
    return trax(criteria, yes, no).fct((c, y, n) => (c) ? y : n);
};
export var NOT = (criteria) => {                                        // create a trax node that returns !criteria
    return trax(criteria).fct((c) => !c);
};
export var CHOOSE = (key, selection, otherwise) => {                    // create a trax node that returns a value from selection based on the key; returns otherwise if no key
    return trax(key, selection, otherwise).fct( (k, s, o) => {
        return s[k] ?? o;                                               // selection is object or array
    });
}
export var ARRAYLENGTH = (arr) => {                                     // create a trax node that returns the length of an array
    return trax(arr).fct( arr => arr.length );
}
export var FILTER = (arr, filterFct) => {                               // create a trax node that filters an array
    return trax(arr, filterFct).fct( (arr, filterFct) => arr.filter( a => filterFct(a) ) );
}
export var INC = (trigger, initial, increment=1, modulo = Number.MAX_VALUE) => {    
                                                                        // create a trax node that increments an initial value every time the trigger element changes (or is fired)
    return trax(trigger,increment).fct((x,inc,current) => ((current ?? initial) + inc) % modulo );
}
export var TOGGLE = (initial) => {
    return trax(initial).fct( (i, v = initial) => !v );                 // Toggle the result true <=> false every time this instance fires.
}
export var XHR = (url, traxNode, req) => {                              // Make a XMLHttpRequest to url and put the response into traxNode
    req ??= new XMLHttpRequest();
    req.responseType = "text";

    return trax(url).fct( (u) => {
        if (!u) return;
        req.onload = (e) => {
            traxNode(req.response);
        };
        req.open("GET", u);
        req.send();
    }).onChange(true);
}