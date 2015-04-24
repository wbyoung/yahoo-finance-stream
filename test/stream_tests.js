'use strict';

var chai = require('chai');
var expect = chai.expect;
var util = require('util');
var Stream = require('..').Stream;
var sinon = require('sinon');
chai.use(require('sinon-chai'));

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

  it('emits pending data after close', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    var spy = sinon.spy();
    stocks.resume();
    stocks.close();
    stocks.on('data', spy);
    stocks.on('error', done);
    stocks.on('end', function() {
      expect(spy).to.have.been.called;
      done();
    });
  });

  it('allows pause & resume', function(done) {
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

  it('can be closed immediately', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.close();
    stocks.resume(); // must be flowing
    stocks.on('error', done);
    stocks.on('end', function() {
      expect(app.requests.length).to.eql(0);
      done();
    });
  });

  it('emits errors for connection problems', function(done) {
    var stocks = new Stream({ endpoint: 'http://localhost:39232' });
    stocks.resume();
    stocks.on('error', function(e) {
      expect(e).to.exist;
      done();
    });
    stocks.on('end', function() {
      done(new Error('Expected error to occur.'));
    });
  });

  it('emits data for a single stock', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.watch('vti');
    stocks.on('data', function(data) {
      expect(data.symbol).to.eql('VTI');
      stocks.close();
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('builds url for a single stock', function() {
    var stocks = new Stream({ endpoint: endpoint });
    var query = 'select%20*%20' +
      'from%20yahoo.finance.quotes%20' +
      'where%20symbol%20in%20(%22VTI%22)';
    var env = 'store%3A%2F%2Fdatatables.org%2Falltableswithkeys';
    var url = endpoint +
      '?q=' + query +
      '&format=json' +
      '&env=' + env +
      '&callback=';
    stocks.watch('vti');
    expect(stocks._url()).to.eql(url);
  });
});
