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

  it('can be created without new', function() {
    expect(Stream({ endpoint: endpoint })).to.be.an.instanceof(Stream);
  });

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

  it('does not connect to api endpoint if not watching any stocks', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.on('data', function() {
      done(new Error('No data should have been retrieved'));
    });
    setTimeout(function() {
      expect(app.requests.length).to.eql(0);
      stocks.close();
    }, 10);
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('connects to api endpoint only once stock is added', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.on('data', function() {
      expect(app.requests.length).to.eql(1);
      stocks.close();
    });
    setTimeout(function() {
      expect(app.requests.length).to.eql(0);
      stocks.watch('vti');
    }, 10);
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
    setTimeout(function() {
      stocks.close();
      expect(spy).to.not.have.been.called;
    }, 0);
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

  it('can be closed immediately after watching a stock', function(done) {
    var stocks = new Stream({ endpoint: endpoint, frequency: 1 });
    stocks.watch('vti');
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


  it('does not make more requests than required', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.watch('vti');
    stocks.on('data', function() {
      expect(app.requests.length).to.eql(1);
    });
    setTimeout(stocks.close.bind(stocks), 10);
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('queues an immediate request for newly added symbols', function(done) {
    // we add VTI, and a quote will be scheduled to come in immediately.
    var stocks = new Stream({ endpoint: endpoint });
    stocks.watch('vti');

    // we add VXUS, but not right away. instead, we add it midway through the
    // handling of the request for VTI.
    app.on('req', function() {
      if (app.requests.length === 1) {
        stocks.watch('vxus');
      }
    });

    // we expect that even though the polling frequency is at 60 seconds,
    // that the late addition of the VXUS will queue up another request right
    // after the initial request completes.
    stocks.on('data', function() {
      if (app.requests.length === 2) {
        // once all requests we expect are in, we delay just a bit on closing
        // the stream to ensure that we're back to the same 60 second polling
        // schedule and no more requests come in.
        setTimeout(stocks.close.bind(stocks), 10);
      }
    });

    stocks.on('error', done);
    stocks.on('end', function() {
      expect(app.requests.length).to.eql(2);
      done();
    });

  });
});
