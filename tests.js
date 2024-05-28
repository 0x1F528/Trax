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
    var a = trax(3).id('a');
    var b = trax(a).id('b');
    var c = trax(a).id('c');
    var d = trax(a).id('d');

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

((descr = "active update async") => {
    log(descr);
    Trax.onChange(Trax.MODE.ASYNC);

    var a = trax(3).id('a');
    var b = trax(a).id('b');
    var c = trax(b).id('c').onChange((x) => { assert_equality(x , 4,  descr + " (1)") }) ; // 4 is the correct value as it is the last value set and the one that will be visible when onChange triggers

    a(12);              // change the value of 'a' -> update will propagate up the subscriber tree but onChange will not (yet) be called
    a(4);               // change the value of 'a' -> update will propagate up the subscriber tree but won't be called until this test script completes.

    Trax.onChange(Trax.MODE.SYNC);
})();

((descr = "active update") => {
    log(descr);
    var closure;
    var a = trax(3).id('a');
    var b = trax(a).id('b');
    var c = trax(b).id('c').onChange((x) => { closure = x }) ;

                        // onChange will not execute until there is a change in the publisher tree
    assert_equality(closure , undefined,  descr + " (1)");

    a.fire();           // the fire trigger behaves like an update and will propagate up the subscriber tree
    assert_equality(closure , 3,  descr + " (2)");

    a(4);               // change the value of 'a' -> update will propagate up the subscriber tree
    assert_equality(closure , 4,  descr + " (3)");
})();

((descr = "event count") => {
    log(descr);
    var a = trax(1).id('a');
    var b = trax(1).id('b');
                                            // ignore x, increment current value by inc. 
    var c = trax(a,b).id('c').fct((x,inc,current) => { return (current || 0) + inc; }).onChange(true);

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
    var a = trax(3).id('a');
    var b = trax(a).id('b').fct((x) => {
        return (x < 10) ? x : Trax.HALT;
    });
    var c = trax(b).id('c');

    assert_equality(c(), 3, descr + " (1)");

    a(11);              // 11 is not less than 10 (-> Trax.HALT), so subscribers of 'b' will not be updated
    assert_equality(c(), 3, descr + " (2)");

    a(9);               // 9 is less than 10 and subscribers of 'b' will be updated
    assert_equality(c(), 9, descr + " (3)");
})();

((descr = "active filter") => {
    log(descr);
    var closure;        // closure will be used to snag the current value as seen by the onChange function
    var a = trax().id('a');
    var b = trax(a).id('b').fct((x) => {
        return (x < 10) ? x : Trax.HALT; // when x >= 10 changes will be suppressed/halted and dependent elements won't notice any changes
    });
    var c = trax(b).id('c').onChange((x) => { closure = x; });  // when a change is seen by 'c' the onChange function will be called. Snag the current value.

    a(3);
    assert_equality(closure, 3, descr + " (1)");

    closure = 999;      // set closure to some silly value
    a(11);              // this change will be hidden by 'b' and not seen by 'c'
    assert_equality(closure, 999, descr + " (2)"); // onChange was not called and closure is unchanged at 999

    a(9);               // this change is not filtered by 'b' and change notification will make it to 'c' triggering c.onChange()
    assert_equality(closure, 9, descr + " (3)"); // now updates to 9
})();

((descr = "event signal") => {
  log(descr);
  var changeClosure, eventClosure;
  var FOO = Symbol('foo');
  var a = trax(3).id('a');
  var b = trax(a).id('b');
  var c = trax(b).id('c').onChange((x) => { changeClosure = x; }).handler(FOO, (val, t, arg) => { eventClosure = [val, arg]});

  a.fire();
  assert_equality(changeClosure, 3, descr + " (1)");
  a.fire(FOO, 'baz')  
  assert_equality(eventClosure[0] , 3, descr + " (2)");
  assert_equality(eventClosure[1] , 'baz', descr + " (3)");
})();

((descr = "event signal with modification") => {
  log(descr);
  var changeClosure, eventClosure;
  var APPEND = Symbol('append');
  var a = trax('pot').id('a').handler(APPEND, (val, t, arg) => { t(val + arg); return Trax.HALT; })
  var b = trax(a).id('b');
  var c = trax(b).id('c').onChange((x) => { changeClosure = x; }).handler(APPEND, (val, t, arg) => { eventClosure = [val, arg]});;

  a.fire();
  assert_equality(changeClosure, 'pot', descr + " (1)");
  a.fire(APPEND, 'ato')  
  assert_equality(changeClosure, 'potato', descr + " (2)");
  assert_equality(eventClosure, undefined, descr + " (3)");
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
          "phase": "Symbol(invalidated)",
          "-->": []
        }
      ]
    }
    `
    assert_equality(c.subs(), expectedSubsOfC.replaceAll(/\s/g, ''), descr + " (4)")
})();


((descr = "prune") => {
  log(descr);
  /*
                L1_a          L1_b
                  |            |
                L2_a          L2_b
                     \      /      \
                      L3_ab          L3_c
                     /      \
                L4_a          L4_b
                  |            |
              > L5_a <         |
                  |            |
                L6_a          /
                  |  \       /
                L7_a   L7_ab
                         |
                       L8_ab
  */
  var L1_a = trax(3).id('L1_a');
  var L1_b = trax(3).id('L1_b');
  var L2_a = trax(L1_a).id('L2_a');
  var L2_b = trax(L1_b).id('L2_b');
  var L3_ab = trax(L2_a,L2_b).id('L3_ab').fct( (x,y) => x+y );
  var L3_c = trax(L2_b).id('L3_c');
  var L4_a = trax(L3_ab).id('L4_a');
  var L4_b = trax(L3_ab).id('L4_b');
  var L5_a = trax(L4_a).id('L5_a'); // <--
  var L6_a = trax(L5_a).id('L6_a');
  var L7_a = trax(L6_a).id('L7_a');
  var L7_ab = trax(L6_a,L4_b).id('L7_ab').fct( (x,y) => x+y );
  var L8_ab = trax(L7_ab).id('L8_ab');

  assert_equality(L8_ab(), 12, descr + " (1)");
  var expectedSubsOfL1_a = 
  `
  {
    "value": "3",
    "id": "L1_a",
    "phase": "Symbol(cached)",
    "-->": [
      {
        "value": "3",
        "id": "L2_a",
        "phase": "Symbol(cached)",
        "-->": [
          {
            "value": "6",
            "id": "L3_ab",
            "phase": "Symbol(cached)",
            "-->": [
              {
                "value": "6",
                "id": "L4_a",
                "phase": "Symbol(cached)",
                "-->": [
                  {
                    "value": "6",
                    "id": "L5_a",
                    "phase": "Symbol(cached)",
                    "-->": [
                      {
                        "value": "6",
                        "id": "L6_a",
                        "phase": "Symbol(cached)",
                        "-->": [
                          {
                            "value": "undefined",
                            "id": "L7_a",
                            "phase": "Symbol(invalidated)",
                            "-->": []
                          },
                          {
                            "value": "12",
                            "id": "L7_ab",
                            "phase": "Symbol(cached)",
                            "-->": [
                              {
                                "value": "12",
                                "id": "L8_ab",
                                "phase": "Symbol(cached)",
                                "-->": []
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "value": "6",
                "id": "L4_b",
                "phase": "Symbol(cached)",
                "-->": [
                  {
                    "value": "12",
                    "id": "L7_ab",
                    "phase": "Symbol(cached)",
                    "-->": [
                      {
                        "value": "12",
                        "id": "L8_ab",
                        "phase": "Symbol(cached)",
                        "-->": []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }  
  `
  assert_equality(L1_a.subs(), expectedSubsOfL1_a.replaceAll(/\s/g, ''), descr + " (2)")

  L5_a.prune();

  assert_equality(L8_ab(), undefined, descr + " (3)");
  assert_equality(L3_c(), 3, descr + " (4)");
  assert_equality(L1_a(), undefined, descr + " (5)");

  var expectedSubsOfL1_a_after = 
  `
  {
    "value": "undefined",
    "id": "L1_a",
    "phase": "Symbol(cached)",
    "-->": []
  }
  `
  assert_equality(L1_a.subs(), expectedSubsOfL1_a_after.replaceAll(/\s/g, ''), descr + " (6)")

  var expectedSubsOfL4_a_after = 
  `
  {
    "value": "undefined",
    "id": "L4_a",
    "phase": "Symbol(initial)",
    "-->": []
  }
  `
  assert_equality(L4_a.subs(), expectedSubsOfL4_a_after.replaceAll(/\s/g, ''), descr + " (7)")

  var expectedSubsOfL7_ab_after = 
  `
  {
    "value": "undefined",
    "id": "L7_ab",
    "phase": "Symbol(initial)",
    "-->": []
  }
  `
  assert_equality(L7_ab.subs(), expectedSubsOfL7_ab_after.replaceAll(/\s/g, ''), descr + " (8)")
  
  var expectedSubsOfL1_b_after = 
  `
  {
    "value": "3",
    "id": "L1_b",
    "phase": "Symbol(cached)",
    "-->": [
      {
        "value": "3",
        "id": "L2_b",
        "phase": "Symbol(cached)",
        "-->": [
          {
            "value": "3",
            "id": "L3_c",
            "phase": "Symbol(cached)",
            "-->": []
          }
        ]
      }
    ]
  }
  `
  assert_equality(L1_b.subs(), expectedSubsOfL1_b_after.replaceAll(/\s/g, ''), descr + " (9)")

})();






