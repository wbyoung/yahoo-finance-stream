'use strict';

var _ = require('lodash');
var util = require('util');
var request = require('request');
var through = require('through');
var JSONStream = require('JSONStream');
var Readable = require('stream').Readable;

function Stream(options) {
  Readable.call(this, { objectMode : true });

  this._options = _.defaults({}, options, {
    frequency: 60,
    endpoint: 'https://query.yahooapis.com/v1/public/yql',
  });
};

util.inherits(Stream, Readable);

Stream.prototype._start = function() {
  if (!this._running) {
    this._running = true;
    this._requestQuote();
    this._scheduleTimer();
  }
};

Stream.prototype._stop = function() {
  if (!this._running) {
    this._running = false;
    this._cancelTimer();
  }
};

Stream.prototype._requestQuote = function() {
  var self = this;
  var endpoint = this._options.endpoint;
  var stream = request({
    url: endpoint
  }).pipe(JSONStream.parse());

  stream.on('data', function(data) {
    if (!self.push(data)) {
      self._cancelTimer();
    }
  });
};

Stream.prototype._scheduleTimer = function() {

};

Stream.prototype._cancelTimer = function() {

};

Stream.prototype._read = function(size) {
  this._start();
};

Stream.prototype.close = function() {
  this.push(null);
};

module.exports = new Stream();
module.exports.Stream = Stream;
