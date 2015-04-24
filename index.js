'use strict';

var _ = require('lodash');
var util = require('util');
var qs = require('querystring');
var request = require('request');
var through = require('through');
var JSONStream = require('JSONStream');
var Readable = require('stream').Readable;

function Stream(options) {
  Readable.call(this, { highWaterMark: 1, objectMode : true });

  this._request = null;
  this._symbols = [];
  this._options = _.defaults({}, options, {
    frequency: 60000,
    endpoint: 'https://query.yahooapis.com/v1/public/yql',
  });
};

util.inherits(Stream, Readable);

Stream.prototype.watch = function(symbol) {
  this._symbols.push(symbol.toUpperCase());
};

Stream.prototype._url = function() {
  var symbols = this._symbols.map(function(s) {
    return JSON.stringify(s);
  });
  var yql = util.format(
    'select * from yahoo.finance.quotes ' +
    'where symbol in (%s)', symbols);
  var query = qs.stringify({
    q: yql,
    format: 'json',
    env: 'store://datatables.org/alltableswithkeys',
    callback: '',
  });
  return util.format('%s?%s', this._options.endpoint, query);
};

Stream.prototype._standardize = function(quote) {
  var standardized = { _quote: quote };
  return _.reduce(quote, function(obj, value, key) {
    if (/^[+-]?[\d\.]+$/.test(value)) { value = parseFloat(value); }
    else if (/^[+-]?[\d\.]+%$/.test(value)) { value = parseFloat(value) / 100.0; }
    obj[_.camelCase(key)] = value;
    return obj;
  }, standardized);
};

Stream.prototype._run = function() {
  var self = this;
  var emitError = this._error.bind(this);
  var endpoint = this._options.endpoint;
  var stream = this._request = request({
    url: this._url(),
  })
  .on('error', emitError)
  .pipe(JSONStream.parse())
  .on('error', emitError);

  stream.on('data', function(data) {
    var success = true;
    var quotes = _.flatten([data.query.results.quote]);
    quotes.forEach(function(quote) {
      if (!self.push(self._standardize(quote))) { success = false; }
    });
    if (success) {
      self._setupTimer();
    }
  });

  stream.on('end', function() {
    self._request = null;
  });
};

Stream.prototype._setupTimer = function() {
  this._timer = setTimeout(this._run.bind(this), this._options.frequency);
};

Stream.prototype._cancelTimer = function() {
  clearTimeout(this._timer);
};

Stream.prototype._error = function(e) {
  this.emit('error', e);
  this.close();
};

Stream.prototype._read = function(size) {
  if (!this._request) {
    this._run();
  }
};

Stream.prototype.close = function() {
  var self = this;
  var close = function() {
    self.push(null);
    self._cancelTimer();
  };

  if (this._request) { this._request.on('end', close); }
  else { close(); }
};

module.exports = new Stream();
module.exports.Stream = Stream;
