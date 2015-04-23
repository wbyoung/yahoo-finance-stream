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
    frequency: 60000,
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

  self._waiting = true;

  stream.on('data', function(data) {
    if (self._closing) { return; }
    if (!self.push(data)) {
      self._cancelTimer();
    }
  });

  stream.on('error', function(e) {
    self.emit('error', e);
    self.close();
  });

  stream.on('end', function() {
    self._waiting = false;

    if (self._closing) { return self._close(); }
  });
};

Stream.prototype._scheduleTimer = function() {
  this._timer = setTimeout(this._requestQuote.bind(this), this._options.frequency);
};

Stream.prototype._cancelTimer = function() {
  clearTimeout(this._timer);
};

Stream.prototype._read = function(size) {
  this._start();
};

Stream.prototype._close = function() {
  if (!this._waiting) {
    this.push(null);
  }
}

Stream.prototype.close = function() {
  this._closing = true;
  this._cancelTimer();
  this._close();
};

module.exports = new Stream();
module.exports.Stream = Stream;
