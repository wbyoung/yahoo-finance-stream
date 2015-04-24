'use strict';

var _ = require('lodash');
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
    stocks.watch('vti');
    stocks.on('data', function() {
      expect(app.requests.length).to.eql(1);
      stocks.close();
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('accepts a frequency setting', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.watch('vti');
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
    stocks.watch('vti');
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
    stocks.watch('vti');
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
    stocks.watch('vti');
    stocks.resume();
    stocks.on('error', function(e) {
      expect(e).to.exist;
      done();
    });
    stocks.on('end', function() {
      done(new Error('Expected error to occur.'));
    });
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

  it('builds url for multiple stocks', function() {
    var stocks = new Stream({ endpoint: endpoint });
    var query = 'select%20*%20' +
      'from%20yahoo.finance.quotes%20' +
      'where%20symbol%20in%20(%22VTI%22%2C%22VXUS%22)';
    var env = 'store%3A%2F%2Fdatatables.org%2Falltableswithkeys';
    var url = endpoint +
      '?q=' + query +
      '&format=json' +
      '&env=' + env +
      '&callback=';
    stocks.watch('vti');
    stocks.watch('vxus');
    expect(stocks._url()).to.eql(url);
  });

  describe('when getting a single stock', function() {
    before(function(done) {
      var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
      var quotes = this.quotes = [];
      stocks.watch('vti');
      stocks.on('data', function(quote) {
        quotes.push(quote);
        if (quotes.length === 3) {
          stocks.close();
        }
      });
      stocks.on('error', done);
      stocks.on('end', done);
    });

    it('has the proper symbol', function() {
      expect(this.quotes[0].symbol).to.eql('VTI');
    });

    it('continues to send the same symbol', function() {
      expect(this.quotes[1].symbol).to.eql('VTI');
    });

    it('standardizes the quote object', function() {
      expect(this.quotes[0].yearHigh).to.eql(110.09);
      expect(this.quotes[0].percentChange).to.be.closeTo(0.0007, 0.000001);
    });

    it('stores original quote object', function() {
      expect(this.quotes[0]._quote['YearHigh']).to.eql('110.09');
    });
  });

  describe('when getting a multiple stocks', function() {
    before(function(done) {
      var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
      var quotes = this.quotes = [];
      stocks.watch('vti');
      stocks.watch('vxus');
      stocks.on('data', function(quote) {
        quotes.push(quote);
        if (quotes.length === 4) {
          stocks.close();
        }
      });
      stocks.on('error', done);
      stocks.on('end', done);
    });

    it('has the proper symbols', function() {
      expect(_.map(this.quotes.slice(0, 2), 'symbol'))
        .to.eql(['VTI', 'VXUS']);
    });

    it('has the proper symbols', function() {
      expect(_.map(this.quotes.slice(2, 4), 'symbol'))
        .to.eql(['VTI', 'VXUS']);
    });
  });
});
