Grunge
======

A generator-based underscore and Range like utility library that helps you deal with finite and infinite sequences.

## About
Grunge is inspired by Ruby's Range Class, Underscore.js and Lazy.js, it implements parts of all three and some other things.
Grunge should be your go to library for creating non-trivial sequences, when you need maximum performance.

Underscore and Lazy.js have great tools for dealing with finite collection of numbers. Grunge is there to tackle infinite sequences. e.g fibonacci numbers, prime numbers etc.
In terms of the utility functions Grunge takes an approach closer to Lazy.js rather than Underscore, and no actual computation is done till you ask for values.

Grunge is also a simple utility for composing recursive functions of the time where the solution for n depends on the solution for n-1.

**Note:** Grunge is an experimental library in an early stage of development. There probably will be bugs, and it is by no means ready for production. Tests, bug-fixes and enhancements are welcome.

## Installation
On the browser, you can just download the index.js file from right here and use it.
For Node
```
npm install grunge
```
should work!

## Why Generators?
Generators are slowly finding support and are already available in Chrome, Firefox and Node 0.11.x. Moreover with many transpilers it's easy to convert Grunge into ES5 compliant code. (I will soon add a ES5 distribution ready to use, and available on various Package Managers)

Grunge *could* be written without generators. In fact, for finite sequences, Lazy.js does a great job at achieving lazy evaluation. Generators however, make whole new set of things possible.
And again, with the availability of transpilers, I think the expressiveness of the code is more important.

## Show me some examples

Grunge is made for chaining. When dealing with arrays, Grunge behaves just like Lazy.js

```
// take an array and do what underscore does, but evaluate lazily. No intermediate arrays.
var result = Grunge([1,2,3,4,5]).map(function(n){return n*n;}).map(function(n){return n+1}).filter(isPrime).toArray();

// Make a sequence starting at 1 and a step function 1
var result = Grunge(1,1).map(function(n){return n*n;}).map(function(n){return n+1}).filter(isPrime).take(5).forEach(doSomething);
```

Things can get more interesting when you start feeding step functions into Grunge

```
var rps = Grunge([['rock'], ['paper'], ['scissors']], function(el){
  var results = [];
  for(var i = 0; i < el.length; i++){
    results.push(['rock'].concat(el[i]));
    results.push(['paper'].concat(el[i]));
    results.push(['scissors'].concat(el[i]));
  }
  return results;
}).skip(2).take(1).toArray();
```
Here are you are solving for all possible moves in a game of Rock Paper Scissors in three games, by starting with the base case and iterating rather that recursing.

This can be used for any sequence where the value for n depends on preceding values.



You can even go all out and feed Generator functions into Grunge.

```
var fibinacciSquaredFiltered = Grunge(function*(){
  var first = 1;
  var second = 1;
  yield first;
  yield second;
  while(true){
    let elem = first + second;
    yield elem;
    first = second;
    second = elem;
  }
}).map(function(n){return n*n;}).filter(function(n){return n%2 !== 0;}).step(3).take(100).toArray();
```

Here you have an infinite sequence of fibonacci numbers, you can map each of them to squares, filter out all the even numbers, then pick every third element, and finally get hundred such elements.

Another situation where this might be useful is generating Prime numbers.

```
var Primes = Grunge(function*(){
  for(let i = 2; true; i++){
    yeild Math.pow(2, i) - 1;
  }
}).filter(isPrime).take(100).toArray();
```

You could see how you can add a chain of filters instead of simple isPrime function to make it more performant.

## Infinite Reduce

Reducing an infinite sequence is usually impossible. Instead, for infinite sequences, using the reduce function with arguments (count, function, startValue) will give you a new sequence where every count values are reducing using your given function.

```
Grunge(1,1).take(10).toArray();
// => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

Grunge(1,1).reduce(2, function(a,b){return a+b;}, 0).take(5).toArray();
// => [3, 7, 11, 15, 19]
// Every two elements have been added into a single element
/*  [ 
 *    (1, 2)  -> 3, 
 *    (3, 4)  -> 7,
 *    (5, 6)  -> 11, 
 *    (7, 8)  -> 15,
 *    (9, 10) -> 19
 *  ]
 */

Grunge(1,1).reduce(3, function(a,b){return a+b;}, 0).take(4).toArray();
// => [6, 15, 24, 33]
// Every Three Elements this time
/*  [ 
 *    (1, 2, 3)    -> 6, 
 *    (4, 5, 6)    -> 15,
 *    (7, 8, 9)    -> 24,
 *    (10, 11, 12) -> 33
 *  ]
 */
```

Mathematical Subsequences Made Easy!

## forEachAsync - for limitless forEach

The grunge .forEach method won't let you loop over a possibly infinite sequence to save you from infinite loops, and causing crashes, or worse, freezes.
But you may not have a known upper limit of the number of elements you dealing with, or you may actually be dealing with an infinite amount of data.

Now you can with forEachAsync.

forEachAsync, let's you run a function over a grunge sequence of any or infinite length, it does this by only running one iteration per cycle of the event loop. It does this with a setTimeout after a period of 0. (I'm looking into setImmediate and process.nextTick) But you can also define your own time intervals.

One interesting use is to use this like a buffer. You can create a grunge sequence based on an array and run and forEachAsync over that sequence over a certain period. Since Grunge sequence bind to the actual live array, you can add more elements to the array and keep running the funtion on it endlessly. (Be sure to empty previous elements in the array to save you from running out of memory)

Since this function is completely asyncronous, there is also a callback function you can call when it's done.

Enough talk. Here's the example.


```
var rps = = infiniteGrungeSequence.forEachAsync(yourFunction, timeDelay, callback);
```


## You can use it NOW!

Using Facebook's regenerator, you can compile Grunge into code you can use today. You can choose to use the es5.js file on the client side. If you're using it in node, it's probably a better idea to compile it yourself.

```
var es5Source = require("regenerator")(require('grunge'));
var es5SourceWithRuntime = require("regenerator")(require('grunge'), { includeRuntime: true });
```

## Future
Grunge is a focussed but powerful tool, that is constantly getting better. Though it's currently is beta and has not been thoroughly tested, I will be adding tests and more features in the near future.
I also hope to add some sort of asynchronous evaluation support to eliminate the need to use take methods on infinite sequences.

Pull requests, contributions and feature requests are welcome. It's not too complicated so try to conform to the existing style. Deeper documentation will follow after Grunge is more stable.


