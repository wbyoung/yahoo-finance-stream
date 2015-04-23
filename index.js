'use strict';

var _ = require('lodash');
var util = require('util');
var request = require('request');
var through = require('through');
var JSONStream = require('JSONStream');
var Readable = require('stream').Readable;

function Stream(options) {
  Readable.call(this, { highWaterMark: 1, objectMode : true });

  this._request = null;
  this._options = _.defaults({}, options, {
    frequency: 60000,
    endpoint: 'https://query.yahooapis.com/v1/public/yql',
  });
};

util.inherits(Stream, Readable);

Stream.prototype._run = function() {
  var self = this;
  var endpoint = this._options.endpoint;
  var stream = this._request = request({
    url: endpoint
  }).pipe(JSONStream.parse());

  stream.on('data', function(data) {
    if (self._closed) { return; }
    if (self.push(data)) {
      self._setupTimer();
    }
  });

  stream.on('error', function(e) {
    self.emit('error', e);
    self.close();
  });

  stream.on('end', function() {
    self._request = null;
  });
};

Stream.prototype._setupTimer = function() {
  if (!this._closed) {
    this._timer = setTimeout(this._run.bind(this), this._options.frequency);
  }
};

Stream.prototype._cancelTimer = function() {
  clearTimeout(this._timer);
};

Stream.prototype._read = function(size) {
  if (!this._request) {
    this._run();
  }
};

Stream.prototype.close = function() {
  this._closed = true;
  this._cancelTimer();

  var close = this.push.bind(this, null);
  if (this._request) { this._request.on('end', close); }
  else { close(); }
};

module.exports = new Stream();
module.exports.Stream = Stream;
