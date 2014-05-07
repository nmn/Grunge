(function(
  // Reliable reference to the global object (i.e. window in browsers).
  global,

  // Dummy constructor that we use as the .constructor property for
  // functions that return Generator objects.
  GeneratorFunction,

  // Undefined value, more compressible than void 0.
  undefined
) {
  var hasOwn = Object.prototype.hasOwnProperty;

  if (global.wrapGenerator) {
    return;
  }

  function wrapGenerator(innerFn, outerFn, self, tryList) {
    return new Generator(innerFn, outerFn, self || null, tryList || []);
  }

  global.wrapGenerator = wrapGenerator;
  if (typeof exports !== "undefined") {
    exports.wrapGenerator = wrapGenerator;
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  var Gp = Generator.prototype;
  var GFp = GeneratorFunction.prototype = Object.create(Function.prototype);
  GFp.constructor = GeneratorFunction;
  GFp.prototype = Gp;
  Gp.constructor = GFp;

  wrapGenerator.mark = function(genFun) {
    genFun.__proto__ = GFp;
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Ensure isGeneratorFunction works when Function#name not supported.
  if (GeneratorFunction.name !== "GeneratorFunction") {
    GeneratorFunction.name = "GeneratorFunction";
  }

  wrapGenerator.isGeneratorFunction = function(genFun) {
    var ctor = genFun && genFun.constructor;
    return ctor ? GeneratorFunction.name === ctor.name : false;
  };

  function Generator(innerFn, outerFn, self, tryList) {
    var generator = outerFn ? Object.create(outerFn.prototype) : this;
    var context = new Context(tryList);
    var state = GenStateSuspendedStart;

    function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        throw new Error("Generator has already finished");
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          try {
            var info = delegate.generator[method](arg);

            // Delegate generator ran and handled its own exceptions so
            // regardless of what the method was, we continue as if it is
            // "next" with an undefined arg.
            method = "next";
            arg = undefined;

          } catch (uncaught) {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = uncaught;

            continue;
          }

          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          if (state === GenStateSuspendedStart &&
              typeof arg !== "undefined") {
            // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
            throw new TypeError(
              "attempt to send " + JSON.stringify(arg) + " to newborn generator"
            );
          }

          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            delete context.sent;
          }

        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }
        }

        state = GenStateExecuting;

        try {
          var value = innerFn.call(self, context);

          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: value,
            done: context.done
          };

          if (value === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }

        } catch (thrown) {
          state = GenStateCompleted;

          if (method === "next") {
            context.dispatchException(thrown);
          } else {
            arg = thrown;
          }
        }
      }
    }

    generator.next = invoke.bind(generator, "next");
    generator.throw = invoke.bind(generator, "throw");

    return generator;
  }

  Generator.prototype.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(triple) {
    var entry = { tryLoc: triple[0] };

    if (1 in triple) {
      entry.catchLoc = triple[1];
    }

    if (2 in triple) {
      entry.finallyLoc = triple[2];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry, i) {
    var record = entry.completion || {};
    record.type = i === 0 ? "normal" : "return";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryList.forEach(pushTryEntry, this);
    this.reset();
  }

  Context.prototype = {
    constructor: Context,

    reset: function() {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      // Pre-initialize at least 20 temporary variables to enable hidden
      // class optimizations for simple generators.
      for (var tempIndex = 0, tempName;
           hasOwn.call(this, tempName = "t" + tempIndex) || tempIndex < 20;
           ++tempIndex) {
        this[tempName] = null;
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    keys: function(object) {
      var keys = [];
      for (var key in object) {
        keys.push(key);
      }
      keys.reverse();

      // Rather than returning an object with a next method, we keep
      // things simple and return the next function itself.
      return function next() {
        while (keys.length) {
          var key = keys.pop();
          if (key in object) {
            next.value = key;
            next.done = false;
            return next;
          }
        }

        // To avoid creating an additional object, we just hang the .value
        // and .done properties off the next function object itself. This
        // also ensures that the minifier will not anonymize the function.
        next.done = true;
        return next;
      };
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    _findFinallyEntry: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") && (
              entry.finallyLoc === finallyLoc ||
              this.prev < entry.finallyLoc)) {
          return entry;
        }
      }
    },

    abrupt: function(type, arg) {
      var entry = this._findFinallyEntry();
      var record = entry ? entry.completion : {};

      record.type = type;
      record.arg = arg;

      if (entry) {
        this.next = entry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function(record) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      var entry = this._findFinallyEntry(finallyLoc);
      return this.complete(entry.completion);
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry, i);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(generator, resultName, nextLoc) {
      this.delegate = {
        generator: generator,
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
}).apply(this, Function("return [this, function GeneratorFunction(){}]")());

(function(root, factory){
  'use strict';
  if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function () {
      return (root.Grunge = factory());
    });
  } else {
    // Global Variables
    root.Grunge = factory();
  }
})(this, function(){
  'use strict';

  // only pass in x when step is a function
  // pass in x for memory concerns if you don't always need the whole array.
  var Grunge = function(start, step, x){

    // protection against using the class without the new keyword
    if(!(this instanceof Grunge)){
      return new Grunge(start, step, x);
    }

    //if no arguments are passed, return an empty Object
    if(start === undefined){
      return this;
    }

    // if an instance of Grunge is passed in, and a step
    if((start instanceof Grunge) && (typeof step === 'number')){
      //call .step on the object and return that
      return start.step(step);
    }

    // accepting a 'step' function. Takes a value and returns the next value. gets three values (value, index, arrayOfLast 10 values)
    if(typeof step === 'function'){
      //x = (x && x > 0) ? x : 10;
      this.generator = wrapGenerator.mark(function $callee() {
        var currValue, index, valuesSoFar;

        return wrapGenerator(function $callee$($ctx0) {
          while (1) switch ($ctx0.prev = $ctx0.next) {
          case 0:
            currValue = start;
            index = 0;
            valuesSoFar = [];
          case 3:
            if (!true) {
              $ctx0.next = 12;
              break;
            }

            $ctx0.next = 6;
            return currValue;
          case 6:
            valuesSoFar.push(currValue);

            if(x && x > 0 && valuesSoFar.length > x){
              valuesSoFar.shift();
            }

            currValue = step(currValue, index, valuesSoFar);
            index ++;
            $ctx0.next = 3;
            break;
          case 12:

          case 13:
          case "end":
            return $ctx0.stop();
          }
        }, $callee, this);
      });
      return this;
    }

    //if an array is passed in iterate over the elements.
    if(Array.isArray(start)){
      this.generator = wrapGenerator.mark(function $callee() {
        var i;

        return wrapGenerator(function $callee$($ctx1) {
          while (1) switch ($ctx1.prev = $ctx1.next) {
          case 0:
            i = 0;
          case 1:
            if (!(i < start.length)) {
              $ctx1.next = 7;
              break;
            }

            $ctx1.next = 4;
            return start[i];
          case 4:
            i++;
            $ctx1.next = 1;
            break;
          case 7:
          case "end":
            return $ctx1.stop();
          }
        }, $callee, this);
      });
      this.length = start.length;
      if(!!step){
        return this.step(step);
      }
      return this;
    }

    //if a generator function is passed in
    if(typeof start === 'function'){
      var startIterator = start();
      if(Grunge.isGenerator(startIterator)){
        this.generator = start;
        if(!!step){
          return this.step(step);
        }
        return this;
      }

      //if a generator like function is passed
      if(Grunge.isGeneratorLike(startIterator)){
        this.generator = wrapGenerator.mark(function $callee() {
          var elem;

          return wrapGenerator(function $callee$($ctx2) {
            while (1) switch ($ctx2.prev = $ctx2.next) {
            case 0:
              $ctx2.prev = 0;
              elem = startIterator.next();
            case 2:
              if (!(elem.done === false)) {
                $ctx2.next = 8;
                break;
              }

              $ctx2.next = 5;
              return elem.value;
            case 5:
              elem = startIterator.next();
              $ctx2.next = 2;
              break;
            case 8:
              return $ctx2.abrupt("return", elem.value);
            case 11:
              $ctx2.prev = 11;
              $ctx2.t0 = $ctx2.catch(0);
              return $ctx2.abrupt("return", $ctx2.t0);
            case 14:
            case "end":
              return $ctx2.stop();
            }
          }, $callee, this, [[0, 11]]);
        });
        if(!!step){
          return this.step(step);
        }
        return this;
      }
    }

    //finally accounting for primitive values
    this.generator = wrapGenerator.mark(function $callee() {
      var i, elem;

      return wrapGenerator(function $callee$($ctx3) {
        while (1) switch ($ctx3.prev = $ctx3.next) {
        case 0:
          i = 0, elem = start;
        case 1:
          if (!true) {
            $ctx3.next = 8;
            break;
          }

          $ctx3.next = 4;
          return elem;
        case 4:
          //Grunge accepts a step function as well as a value
          if(typeof step === 'function'){
            elem = step(elem, i);
          } else {
            elem += step;
          }

          i++;
          $ctx3.next = 1;
          break;
        case 8:
        case "end":
          return $ctx3.stop();
        }
      }, $callee, this);
    });

  };

  Grunge.prototype.skip = function(num){
    if(!Grunge.isNaturalNumber(num)){
      throw new Error("skip takes a natural number");
    }

    var that = this;

    var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
      var startIterator, elem, i;

      return wrapGenerator(function $callee$($ctx4) {
        while (1) switch ($ctx4.prev = $ctx4.next) {
        case 0:
          $ctx4.prev = 0;
          startIterator = that.generator();
          elem = startIterator.next();
          i = 0;
        case 4:
          if (!(elem.done === false)) {
            $ctx4.next = 12;
            break;
          }

          if (!(i >= num)) {
            $ctx4.next = 8;
            break;
          }

          $ctx4.next = 8;
          return elem.value;
        case 8:
          elem = startIterator.next();
          i++;
          $ctx4.next = 4;
          break;
        case 12:
          if (!(i > num)) {
            $ctx4.next = 16;
            break;
          }

          return $ctx4.abrupt("return", elem.value);
        case 16:
          return $ctx4.abrupt("return");
        case 17:
          $ctx4.next = 22;
          break;
        case 19:
          $ctx4.prev = 19;
          $ctx4.t1 = $ctx4.catch(0);
          return $ctx4.abrupt("return", $ctx4.t1);
        case 22:
        case "end":
          return $ctx4.stop();
        }
      }, $callee, this, [[0, 19]]);
    }));

    if(!!this.length){
      newGrunge.length = Math.min(this.length - num, 0);
    }
    return newGrunge;
  };


  Grunge.prototype.step = function(num){
    if(!num || num === 0){
      return this;
    }
    if(typeof num !== 'number' && typeof num !== 'function'){
      throw new Error('step takes a number or step function');
    }
    var that = this;
    var i = 0;
    var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
      var iterator, elem, skipNumber, j, temp;

      return wrapGenerator(function $callee$($ctx5) {
        while (1) switch ($ctx5.prev = $ctx5.next) {
        case 0:
          iterator = that.generator();
        case 1:
          if (!true) {
            $ctx5.next = 20;
            break;
          }

          elem = iterator.next();
          skipNumber = (typeof num === 'number')? num : num(elem.value, i);
          i+= skipNumber;
          j = 0;
        case 6:
          if (!(j < skipNumber)) {
            $ctx5.next = 14;
            break;
          }

          temp = iterator.next();

          if (!temp.done) {
            $ctx5.next = 11;
            break;
          }

          elem.done = true;
          return $ctx5.abrupt("break", 14);
        case 11:
          j++;
          $ctx5.next = 6;
          break;
        case 14:
          if (!elem.done) {
            $ctx5.next = 16;
            break;
          }

          return $ctx5.abrupt("return", elem.value);
        case 16:
          $ctx5.next = 18;
          return elem.value;
        case 18:
          $ctx5.next = 1;
          break;
        case 20:
        case "end":
          return $ctx5.stop();
        }
      }, $callee, this);
    }));
    newGrunge.length = this.length;
    if(typeof num === 'number'){
      newGrunge.length = Math.floor(newGrunge.length/num);
    }
    return newGrunge;
  };


  // Grunge.map => takes a map function and returns a new instace of Grunge
  // good for chaining
  Grunge.prototype.map = function(func){
    var that = this;
    if(!func){
      return this;
    }

    var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
      var startIterator, i, elem;

      return wrapGenerator(function $callee$($ctx6) {
        while (1) switch ($ctx6.prev = $ctx6.next) {
        case 0:
          $ctx6.prev = 0;
          startIterator = that.generator();
          i = 0;
          elem = startIterator.next();
        case 4:
          if (!(elem.done === false)) {
            $ctx6.next = 11;
            break;
          }

          $ctx6.next = 7;
          return func(elem.value, i);
        case 7:
          elem = startIterator.next();
          i++;
          $ctx6.next = 4;
          break;
        case 11:
          return $ctx6.abrupt("return", func(elem.value, i));
        case 14:
          $ctx6.prev = 14;
          $ctx6.t2 = $ctx6.catch(0);
          return $ctx6.abrupt("return", $ctx6.t2);
        case 17:
        case "end":
          return $ctx6.stop();
        }
      }, $callee, this, [[0, 14]]);
    }));

    newGrunge.length = this.length;
    return newGrunge;
  };

  //takes a truth test. Returns a new instance of Grunge
  Grunge.prototype.filter = function(func){
    var that = this;
    if(!func){
      return this;
    }

    var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
      var startIterator, i, elem;

      return wrapGenerator(function $callee$($ctx7) {
        while (1) switch ($ctx7.prev = $ctx7.next) {
        case 0:
          $ctx7.prev = 0;
          startIterator = that.generator();
          i = 0;
          elem = startIterator.next();
        case 4:
          if (!(elem.done === false)) {
            $ctx7.next = 12;
            break;
          }

          if (!!!func(elem.value, i)) {
            $ctx7.next = 8;
            break;
          }

          $ctx7.next = 8;
          return elem.value;
        case 8:
          i++;
          elem = startIterator.next();
          $ctx7.next = 4;
          break;
        case 12:
          if (!!!func(elem.value, i)) {
            $ctx7.next = 14;
            break;
          }

          return $ctx7.abrupt("return", elem.value);
        case 14:
          $ctx7.next = 19;
          break;
        case 16:
          $ctx7.prev = 16;
          $ctx7.t3 = $ctx7.catch(0);
          return $ctx7.abrupt("return", $ctx7.t3);
        case 19:
        case "end":
          return $ctx7.stop();
        }
      }, $callee, this, [[0, 16]]);
    }));

    newGrunge.length = this.length;
    return newGrunge;
  };

  //Important function. Needed to make the infinite sequence a finite sequence
  Grunge.prototype.take = function(num){
    var that = this;
    if(!num || !Grunge.isNaturalNumber(num)){
      throw new Error('Take takes a natural number');
    }

    if(this.length < num){
      return this;
    }

    var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
      var iterator, i, elem;

      return wrapGenerator(function $callee$($ctx8) {
        while (1) switch ($ctx8.prev = $ctx8.next) {
        case 0:
          iterator = that.generator();
          i = 0;
        case 2:
          if (!(i < num)) {
            $ctx8.next = 11;
            break;
          }

          elem = iterator.next();
          $ctx8.next = 6;
          return elem.value;
        case 6:
          if (!elem.done) {
            $ctx8.next = 8;
            break;
          }

          return $ctx8.abrupt("break", 11);
        case 8:
          i++;
          $ctx8.next = 2;
          break;
        case 11:
        case "end":
          return $ctx8.stop();
        }
      }, $callee, this);
    }));
    newGrunge.length = num;
    return newGrunge;
  };

  Grunge.prototype.forEach = function(func){
    if(!this.length){
      throw new Error('Cannot Loop over infinite sequence');
    }
    if(!func){
      return this;
    }
    // old version with for-of loops
    // for(var elem of this.generator()){
    //   func(elem);
    // }


    try {
      var startIterator = this.generator();
      var i = 0;
      var elem = startIterator.next();
      while(elem.done === false){
        func(elem.value, i);
        elem = startIterator.next();
        i++;
      }
      // not sure why this is happening
      //func(elem.value, i);
    } catch (e){
      return e;
    }
  };

  Grunge.prototype.reduce = function(count, func, startValue){
    if(typeof count === 'function'){
      if(!this.length){
        throw new Error('Cannot Loop over infinite sequence');
      }
      if(startValue === undefined){
        startValue = this.generator().next().value;
      }
      this.forEach(function(elem){
        startValue = func(elem, startValue);
      });
      return startValue;
    } else {
      if(!Grunge.isNaturalNumber(count)){
        throw new Error('the first argument must be a natural number for this to work');
      }
      
      var myStartValue = startValue || this.generator().next().value;
      var that = this;
      var newGrunge = new Grunge(wrapGenerator.mark(function $callee() {
        var iterator, lastValue, temp, i;

        return wrapGenerator(function $callee$($ctx9) {
          while (1) switch ($ctx9.prev = $ctx9.next) {
          case 0:
            iterator = that.generator();
            lastValue = {value : myStartValue};
          case 2:
            if (!true) {
              $ctx9.next = 19;
              break;
            }

            temp = startValue !== undefined ? startValue : lastValue.value;
            i = 0;
          case 5:
            if (!(i < count)) {
              $ctx9.next = 13;
              break;
            }

            lastValue = iterator.next();
            temp = func(lastValue.value, temp);

            if (!lastValue.done) {
              $ctx9.next = 10;
              break;
            }

            return $ctx9.abrupt("break", 13);
          case 10:
            i++;
            $ctx9.next = 5;
            break;
          case 13:
            $ctx9.next = 15;
            return temp;
          case 15:
            if (!lastValue.done) {
              $ctx9.next = 17;
              break;
            }

            return $ctx9.abrupt("break", 19);
          case 17:
            $ctx9.next = 2;
            break;
          case 19:
          case "end":
            return $ctx9.stop();
          }
        }, $callee, this);
      }));
      if(this.length) {
        newGrunge.length = Math.ceil(this.length/count);
      }
      return newGrunge;
    }
  };

  Grunge.prototype.toArray = function(){
    var result = [];
    this.forEach(function (elem, index) {
      result.push(elem);
    });
    return result;
  };

  Grunge.prototype.first = function(num){
    return this.take(num).toArray();
  };


  /*
   * Helper Methods
   */

  //Credit : Visionmedia/Co
  Grunge.isGenerator = function(obj) {
    return obj && 'function' === typeof obj.next && 'function' === typeof obj.throw;
  };

  Grunge.isGeneratorLike = function(obj) {
    return obj && 'function' === typeof obj.next;
  };

  Grunge.isNaturalNumber = function(num){
    return (typeof num === 'number') && num >= 1 && num % 1 === 0;
  };

  return Grunge;
});