# Trax

Trax is a minimal reactive pub/sub solution in JavaScript that emphasizes explicit dependencies between pub/sub elements. It allows you to manage data flow in your applications efficiently by providing control over when and how updates occur.

## Features

- **Explicit Dependencies**: Trax ensures that dependencies between pub/sub elements are clearly defined, making it easier to understand the data flow in your application.

- **Selective Automatic Updates**: You have the flexibility to choose whether child nodes should automatically update when a parent node changes. This selective approach allows for better control over when updates occur, optimizing performance and resource usage.

- **Filtered Propagation**: With Trax, you can filter (suppress) parent node changes to prevent them from propagating. This feature is useful when you want to manage updates more selectively, preventing unnecessary updates in specific scenarios.

## Usage

```javascript
// Example usage of Trax
import { trax, Trax } from './trax.js'

// Create a new Trax instance
var a = trax('original value');

// Define dependency between parent and child
var b = trax(a);

// Update parent value
a('new value');

// Fetch value from child
console.log(b());

// Automatically update child on parent updates and trigger a side-effect
b.onChange((x) -> { console.log(x); });

// 'a has changed' will be output to the console when a() is updated
a('a has changed');

// create a new trax without value and without dependency
var c = trax();

// make c dependent on 'b' (and transitively 'a')
c(b);
console.log(c()); // -> current value of 'a' is 'a has changed', this propagates to 'b' and to 'c' 

// Children can depend on multiple parents and merge their values into a single value
var firstname = trax('Sam');
var lastname = trax('Hill');
var age = trax(42);
var person = trax(firstname, lastname, age).fct(
    (f,l,a) => { 
        return { 
            name: f + ' ' + l, 
            age : a 
        }; 
    });
console.log(person());

// Use instanceof to check for Trax elements
e instanceof Trax

// Further examples can be found in the tests.js file
