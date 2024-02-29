import { trax, Trax } from './trax.js'

var loglevel = 1;

var log = (test) => {
    if (loglevel == 1) {
        console.log("Test ", test);
    }
}

var assert_equality = (received, expected, test) => {
    console.assert(received === expected, "Test %s => Expected %s, got %s", test, expected, received)
    if (loglevel == 2) {
        console.log("Test ", test);
    }
}

((descr = "dependency depth") => {

    var firstname = trax('Sam');
    var lastname = trax('Hill');
    var age = trax(42);
    var person = trax(firstname, lastname, age).fct((f,l,a) => { return { name: f + ' ' + l, age : a }; });
    console.log(person());
})();


((descr = "dependency depth") => {
    log(descr);
    var a = trax(3);
    var b = trax(a);
    var c = trax(b);

    assert_equality(c() , 3, descr + " (1)");

    a(15);
    assert_equality(c() , 15, descr + " (2)");

})();


((descr = "multi dependency") => {
    log(descr);
    var a = trax(3);
    var b = trax(4);
    var c = trax(a,b).fct((x,y) => x - y);

    assert_equality(c() , -1,  descr + " (1)");

    c(b,a);
    assert_equality(c() , 1,  descr + " (2)");

})();

((descr = "fan out") => {
    log(descr);
    var a = trax(3);
    var b = trax(a);
    var c = trax(a);
    var d = trax(a);

    assert_equality(a() , 3,  descr + " (1)");
    assert_equality(b() , 3,  descr + " (2)");
    assert_equality(c() , 3,  descr + " (3)");
    assert_equality(d() , 3,  descr + " (4)");

    a(4);
    c(5);
    assert_equality(a() , 4,  descr + " (5)");
    assert_equality(b() , 4,  descr + " (6)");
    assert_equality(c() , 5,  descr + " (7)");
    assert_equality(d() , 4,  descr + " (8)");

})();

((descr = "active update") => {
    log(descr);
    var closure;
    var a = trax(3);
    var b = trax(a);
    var c = trax(b).onChange((x) => { closure = x; }) ;

    a.fire(); // need to trigger at least once to activate c(). Could also call c() or reset a(3);

    assert_equality(closure , 3,  descr + " (1)");

    a(4);
    assert_equality(closure , 4,  descr + " (2)");
})();

((descr = "event count") => {
    log(descr);
    var a = trax(1);
    var b = trax(1);
                                            // ignore x, increment current value by inc. 
    var c = trax(a,b).fct((x,inc,current) => { return (current || 0) + inc; }).onChange(true);

    assert_equality(c() , 1,  descr + " (1)");
    a.fire();
    assert_equality(c() , 2,  descr + " (2)");
    assert_equality(c() , 2,  descr + " (3)");
    b(3);               // will fire and increment by 3 -> 5
    a.fire();           // should now increment by 3 -> 8
    a.fire();           // should now increment by 3 -> 11
    assert_equality(c() , 11,  descr + " (4)");
})();

((descr = "filter") => {
    log(descr);
    var a = trax(3);
    var b = trax(a).fct((x) => {
        return (x < 10) ? x : trax.SUPPRESSED;
    });
    var c = trax(b);

    assert_equality(c(), 3, descr + " (1)");

    a(11);
    assert_equality(c(), 3, descr + " (2)");

    a(9);
    assert_equality(c(), 9, descr + " (3)");
})();

((descr = "active filter") => {
    log(descr);
    var closure;
    var a = trax(3);
    var b = trax(a).fct((x) => {
        return (x < 10) ? x : trax.SUPPRESSED; // when x >= 10 changes will be suppressed and dependent elements won't notice any changes
    });
    var c = trax(b).onChange((x) => { closure = x; });

    c(); // need to trigger at least once to activate c(). Could also call a.fire() or reset a(3);

    assert_equality(closure, 3, descr + " (1)");

    a(11);
    assert_equality(closure, 3, descr + " (2)"); // still 3 !

    a(9);
    assert_equality(closure, 9, descr + " (3)"); // now updates to 9
})();

((descr = "logging") => {
    log(descr);
    var closure = [];
    var logger = (x) => { closure.push( x )};
    var a = trax(3).id('a').log(logger);
    var b = trax(a).id('b').log(logger);
    var c = trax(b).id('c').log(logger).onChange(true);

    assert_equality(closure.length, 3, descr + " (1)");
    assert_equality(closure[0], 'Update to a: undefined => 3', descr + " (1.1)");
    assert_equality(closure[1], 'Update to b: undefined => 3', descr + " (1.2)");
    assert_equality(closure[2], 'Update to c: undefined => 3', descr + " (1.3)");

    a(15);
    assert_equality(closure.length, 6, descr + " (2)");
    assert_equality(closure[3], 'Update to a: undefined => 15', descr + " (2.1)");
    assert_equality(closure[4], 'Update to b: 3 => 15', descr + " (2.2)");
    assert_equality(closure[5], 'Update to c: 3 => 15', descr + " (2.3)");
})();






