Grunge
======

A generator-based sequence generator and utility.

## About
Grunge is inspired by Ruby's Range Class, Underscore.js and Lazy.js, it implements parts of all three and some other things.
Grunge should be your go to libraries for creating non-trivial sequences, when you need maximum performance.

Underscore and Lazy.js are great tools for dealing with finite collection of numbers. Grunge is there to tackle infinite sequences. e.g fibonacci numbers, prime numbers etc.
In terms of the utility functions Grunge takes an approach closer to Lazy.js rather than Underscore, and no actual computation is done till you ask for values.

**Note:** Grunge is an expreiment library in an early stage of it's development. There probably will be bugs, and it is by no means ready for production. Tests, bug-fixes and enhancements are welcome.

## Why Generators?
Generators are slowly funding support and are already available in Chrome, Firefox and Node 0.11.x. Moreover with many transpilers it's easy to convert Grunge into ES5 compliant code. (I will soon add a ES5 distribution ready to use, and available on various Package Managers)

Grunge *could* be written without generators, but the code would be longer and more complicated. And again, with the availability of transpilers, I think the expressiveness of the code is more important.

## Show me some examples

Grunge is made for chaining. When dealing with arrays, Grunge behaves just like Lazy.js

```
// take an array and do what underscore does, but evaluate lazily. No intermediate arrays.
var result = Grunge([1,2,3,4,5]).map(function(n){return n*n;}).map(function(n){return n+1}).filter(isPrime).toArray();

// Make a sequence starting at 1 and a step function 1
var result = Grunge(1,1).map(function(n){return n*n;}).map(function(n){return n+1}).filter(isPrime).take(5).toArray();
```

Things can get more interesting when you start feeding generator functions into Grunge

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

Here you have an infinite sequence of fibinacci numbers, you can map each of them to squares, filter out all the even numbers, then pick every third element, and finally get hundred such elements.

Another situation where this might be useful is generating Prime numbers.

```
var Primes = Grunge(function*(){
  for(let i = 2; true; i++){
    yeild Math.pow(2, i) - 1;
  }
}).filter(isPrime).toArray();
```

You could see how you can add a chain of filters instead of simple isPrime function to make it more performant.

## Future
Grunge is just a small tool right now, with very limited use-cases.
I hope to add support for asynchronous computation in the future. It mostly comes down to design decisions, but with asynchronous results, parallel computation with web workers, and some smart users, Grunge could be a powerful niche tool.

