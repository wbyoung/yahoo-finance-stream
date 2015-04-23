'use strict';

var chai = require('chai');
var expect = chai.expect;
var util = require('util');
var Stream = require('..').Stream;

// fake endpoint app
var app = require('./fakes/endpoint'), server;
var port = 23493;
var endpoint = util.format('http://localhost:%d', port);


describe('stream', function() {
  before(function(done) { server = app.listen(port, done); });
  after(function(done) { server.close(done); });

  beforeEach(function() { app.reset(); });

  it('connects to api endpoint', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.on('data', function() {
      expect(app.requests.length).to.eql(1);
      stocks.close();
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('accepts a frequency setting', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.on('data', function() {
      if (app.requests.length == 4) {
        stocks.close();
      }
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('does not send data after close', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.resume();
    stocks.close();
    stocks.on('data', function() {
      done(new Error('Data sent after close of stream.'));
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('allows pause', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.once('data', function() {
      expect(app.requests.length).to.eql(1);
    });
    stocks.pause();
    setTimeout(function() {
      expect(app.requests.length).to.eql(1);
      stocks.resume();
    }, 20);
    app.on('req', function() {
      if (app.requests.length === 4) {
        stocks.close();
      }
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });
});
