/********************************************************************************************************************
    Utility functions useful for Trax and Trix applications

********************************************************************************************************************/

/*------------------------------------------------------------------------------------------------------------------
    function composition helper functions
------------------------------------------------------------------------------------------------------------------*/
export var pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);     // list of functions will be executed in order, result of each being passed to the next function
export var compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x); // list of functions will be executed in reverse order, result of each being passed to the next function
export var when = (key, execute) => value => {                          // for a given key and execution function
    if (key === value) execute(value);                                  // execute if the key matches the passed in value
    return value;
};

/*------------------------------------------------------------------------------------------------------------------
    Updates the destination list (of type B) to match the source list (of type A)
    - keeps the destination items intact if they are in the source list (equalsFct)
    - creates new items if they don't exist in the destination (createFct)
    - removes any destination elements if they are not in the source list
 ------------------------------------------------------------------------------------------------------------------*/
export function reconcileArrays(source, destination, equalsFct, createFct) {
    for (var s = 0; s < source.length; s++) {
        var sElem = source[s];

        for (var d = s; d < destination.length; d++) {
            var dElem = destination[d];
            if (equalsFct(sElem, dElem)) {
                if (d > s) { // if d===s we don't have to do anything - just move on to the next element
                    destination.splice(s, 0, destination.splice(d,1)[0])
                }
                break; // out of this inner loop
            }
        }
        if (s >= destination.length) { // beyond the end of the destination array
            destination.push( createFct(sElem) );
        } else if (d >= destination.length) {  // doesn't exist in destination array
            destination.splice( s, 0, createFct(sElem) ); // insert here
        }
    }
    destination.splice(source.length, destination.length - source.length); // remove any remaining destination nodes at the end (they are not in the source list)
    return destination;
};

/*------------------------------------------------------------------------------------------------------------------
    diffMapper returns a function that captures initial array value and then returns a boolean array detailing which elements have changed since the last call
    This is useful within Trax when we need to know which of the publisher elements have actually changed
 ------------------------------------------------------------------------------------------------------------------*/
export function diffMapper () {
    var previousArgs;
    return (args) => {
        previousArgs ??= args;
        let res = args.map((v,i) => (i < previousArgs.length && v !== previousArgs[i]));
        previousArgs = args;
        return res;
    }
};
    

/*------------------------------------------------------------------------------------------------------------------
    prettyJSON is a code snippet that will pretty print JSON (output from trax().subs and .pubs, for example)
 ------------------------------------------------------------------------------------------------------------------*/
 export function prettyJSON (str)  {
    return JSON.stringify(JSON.parse(str),null,2);
}
  
  
