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
    var a = trax(3).id('a');
    var b = trax(4).id('b');
    var c = trax(a,b).id('c').fct((x,y) => x - y);
    var d = trax(c).id('d');

    assert_equality(c() , -1,  descr + " (1)");

    c(b,a);
    assert_equality(c() , 1,  descr + " (2)");

    c(10,a);
    assert_equality(c() , 7,  descr + " (3)");

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

                        // onChange will not execute until there is a change in the publisher tree
    assert_equality(closure , undefined,  descr + " (1)");

    a.fire();           // the fire trigger behaves like an update and will propagate up the subscriber tree
    assert_equality(closure , 3,  descr + " (2)");

    a(4);               // change the value of 'a' -> update will propagate up the subscriber tree
    assert_equality(closure , 4,  descr + " (3)");
})();

((descr = "event count") => {
    log(descr);
    var a = trax(1);
    var b = trax(1);
                                            // ignore x, increment current value by inc. 
    var c = trax(a,b).fct((x,inc,current) => { return (current || 0) + inc; }).onChange(true);

                        // the dependency fct of 'c' will be executed when onChange is set
    assert_equality(c() , 1,  descr + " (1)");
    a.fire();           // propagate the trigger up the subscriber tree
    assert_equality(c() , 2,  descr + " (2)");
    assert_equality(c() , 2,  descr + " (3)");
    b(3);               // publisher update -> will fire and increment by 3 -> 5
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

    a(11);              // 11 is not less than 10 (-> trax.SUPPRESSED), so subscribers of 'b' will not be updated
    assert_equality(c(), 3, descr + " (2)");

    a(9);               // 9 is less than 10 and subscribers of 'b' will be updated
    assert_equality(c(), 9, descr + " (3)");
})();

((descr = "active filter") => {
    log(descr);
    var closure;        // closure will be used to snag the current value as seen by the onChange function
    var a = trax();
    var b = trax(a).fct((x) => {
        return (x < 10) ? x : trax.SUPPRESSED; // when x >= 10 changes will be suppressed and dependent elements won't notice any changes
    });
    var c = trax(b).onChange((x) => { closure = x; });  // when a change is seen by 'c' the onChange function will be called. Snag the current value.

    a(3);
    assert_equality(closure, 3, descr + " (1)");

    closure = 999;      // set closure to some silly value
    a(11);              // this change will be hidden by 'b' and not seen by 'c'
    assert_equality(closure, 999, descr + " (2)"); // onChange was not called and closure is unchanged at 999

    a(9);               // this change is not filtered by 'b' and change notification will make it to 'c' triggering c.onChange()
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

((descr = "inspect pubs and subs") => {
    log(descr);
    var a = trax(3).id('a');
    var b1 = trax(a).id('b1');
    var b2 = trax(a).id('b2');
    var c = trax(b1,b2).id('c').fct((x,y) => x + y);
    var d1 = trax(c).id('d1');
    var d2 = trax(c).id('d2');

    assert_equality(d1(), 6, descr + " (1)");

    var expectedPubsForC = 
    `
    {
      "value": "6",
      "id": "c",
      "phase": "Symbol(cached)",
      "<--": [
        {
          "value": "3",
          "id": "b1",
          "phase": "Symbol(cached)",
          "<--": [
            {
              "value": "3",
              "id": "a",
              "phase": "Symbol(cached)",
              "<--": [
                3
              ]
            }
          ]
        },
        {
          "value": "3",
          "id": "b2",
          "phase": "Symbol(cached)",
          "<--": [
            {
              "value": "3",
              "id": "a",
              "phase": "Symbol(cached)",
              "<--": [
                3
              ]
            }
          ]
        }
      ]
    }
    `

    assert_equality(c.pubs(), expectedPubsForC.replaceAll(/\s/g, ''), descr + " (2)")

    var expectedImmediatePubsForC = 
    `
    {
      "value": "6",
      "id": "c",
      "phase": "Symbol(cached)",
      "<--": [
        {
          "value": "3",
          "id": "b1",
          "phase": "Symbol(cached)",
          "<--": []
        },
        {
          "value": "3",
          "id": "b2",
          "phase": "Symbol(cached)",
          "<--": []
        }
      ]
    }
    `
    assert_equality(c.pubs(1), expectedImmediatePubsForC.replaceAll(/\s/g, ''), descr + " (3)"); // only 1 level down

    var expectedSubsOfC = 
    `
    {
      "value": "6",
      "id": "c",
      "phase": "Symbol(cached)",
      "-->": [
        {
          "value": "6",
          "id": "d1",
          "phase": "Symbol(cached)",
          "-->": []
        },
        {
          "value": "undefined",
          "id": "d2",
          "phase": "Symbol(unknown)",
          "-->": []
        }
      ]
    }
    `
    assert_equality(c.subs(), expectedSubsOfC.replaceAll(/\s/g, ''), descr + " (4)")
})();






