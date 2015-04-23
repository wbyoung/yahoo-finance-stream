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
  before(function(done) { server = app.listen(port, done); app.reset(); });
  after(function(done) { server.close(done); });

  it('connects to api endpoint', function(done) {
    var stocks = new Stream({ endpoint: endpoint });
    stocks.on('data', function() {
      expect(app.requests.length).to.eql(1);
      stocks.close();
    });
    stocks.on('error', done);
    stocks.on('end', done);
  });

  it('allows pause');
});
