var g = require('./../index.js');
var assert = require("assert");
var should = require('should');

describe('Tests for Grunge', function(){

  describe('Array Methods', function(){

    it('return all values in an array when .toArray is called', function(){
      var sequence = g([1,2,3]);
      (sequence.toArray()).should.eql([1,2,3]);
    });

    it('maps array values', function(){
      var sequence = g([1,2,3]).map(function(n){return n+1});
      sequence.toArray().should.eql([2,3,4]);
    });

    it('chaining maps on array values', function(){
      var sequence = g([1,2,3]).map(function(n){return n+1}).map(function(n){return n*n});
      (sequence.toArray()).should.eql([4,9,16]);
    });

    it('binds to a live array', function(){
      var arr = [1,2,3];
      var sequence = g(arr).map(function(n){return n+1}).map(function(n){return n*n});
      (sequence.toArray()).should.eql([4,9,16]);
      arr.push(4);
      (sequence.toArray()).should.eql([4,9,16,25]);
      arr.shift();
      (sequence.toArray()).should.eql([9,16,25]);
    });

  });

});