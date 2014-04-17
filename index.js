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

  var Grunge = function(start, step){

    // protection against using the class without the new keyword
    if(!(this instanceof Grunge)){
      return new Grunge(start, step);
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

    //if an array is passed in iterate over the elements.
    if(Array.isArray(start)){
      this.generator = function*(){
        for(let i = 0; i < start.length; i++){
          yield start[i];
        }
      };
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
        this.generator = function* (){
          try {
            var elem = startIterator.next();
            while(elem.done === false){
              yield elem.value;
              elem = startIterator.next();
            }
            return elem.value;
          } catch (e){
            return;
          }
        };
        if(!!step){
          return this.step(step);
        }
        return this;
      }
    }

    //finally accounting for primitive values
    this.generator = function* (){
      var i = 0, elem = start;
      while(true){
        yield elem;
        //Grunge accepts a step function as well as a value
        if(typeof step === 'function'){
          elem = step(elem, i);
        } else {
          elem += step;
        }
        i++;
      }
    };

  };

  Grunge.prototype.skip = function(num){
    if(!Grunge.isNaturalNumber(num)){
      throw new Error("skip takes a natural number");
    }
    var that = this;

    var newGrunge = new Grunge(function* (){
      var i = 0;
      for(let elem of that.generator()){
        i++;
        if(i > num){
          yield elem;
        }
      }
    });
    if(!!this.length){
      newGrunge.length = Math.min(this.length - num, 0);
    }
    return newGrunge;
  }


  Grunge.prototype.step = function(num){
    if(!num || num === 1){
      return this;
    }
    if(typeof num !== 'number' && typeof num !== 'function'){
      throw new Error('step takes a number or step function');
    }
    var that = this;
    var i = 0;
    var newGrunge = new Grunge(function* (){
      var iterator = that.generator();
      while(true){
        let elem = iterator.next();
        let skipNumber = (typeof num === 'number')? num : num(elem.value, i);
        i+= skipNumber;
        for(let j = 0; j < skipNumber; j++){
          let temp = iterator.next();
          if(temp.done){
            elem.done = true;
            break;
          }
        }
        if(elem.done){
          return elem.value;
        }
        yield elem.value;
      }
    });
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
    var newGrunge = new Grunge(function* (){
      for(let elem of that.generator()){
        yield func(elem);
      }
    });
    newGrunge.length = this.length;
    return newGrunge;
  };

  //takes a truth test. Returns a new instance of Grunge
  Grunge.prototype.filter = function(func){
    var that = this;
    if(!func){
      return this;
    }
    var newGrunge = new Grunge(function* (){
      for(let elem of that.generator()){
        if(!!func(elem)){
          yield elem;
        }
      }
    });
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

    var newGrunge = new Grunge(function* (){
      var iterator = that.generator();
      for(let i = 0; i < num; i++){
        let elem = iterator.next();
        yield elem.value;
        if(elem.done){
          break;
        }
      }
    });
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
    for(let elem of this.generator()){
      func(elem);
    }
  };

  Grunge.prototype.reduce = function(startValue, func){
    if(startValue === undefined){
      startValue = this.generator().next();
    }
    this.forEach(function(elem){
      startValue = func(elem, startValue);
    });
    return startValue;
  };

  Grunge.prototype.toArray = function(){
    var result = [];
    for(let elem of this.generator()){
      result.push(elem);
    }
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