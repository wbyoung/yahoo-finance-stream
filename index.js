'use strict';

var _ = require('lodash');
var util = require('util');
var qs = require('querystring');
var request = require('request');
var JSONStream = require('JSONStream');
var Readable = require('stream').Readable;

function Stream(options) {
  if (!(this instanceof Stream)) {
    return new Stream(options);
  }

  Readable.call(this, { highWaterMark: 1, objectMode : true });

  this._request = null;
  this._symbols = [];
  this._options = _.defaults({}, options, {
    frequency: 60000,
    endpoint: 'https://query.yahooapis.com/v1/public/yql',
  });
}

util.inherits(Stream, Readable);

Stream.prototype.watch = function(symbol) {
  this._symbols.push(symbol.toUpperCase());
  this._schedule({ immediate: true });
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

Stream.prototype._canRun = function() {
  return this._request === null && // only allow one request
    this._symbols.length !== 0; // only run when symbols are present
};

Stream.prototype._run = function() {
  if (!this._canRun()) {
    throw new Error('Cannot run when _canRun returns false.');
  }

  var self = this;
  var emitError = this._error.bind(this);
  var stream = this._request = request({
    url: this._url(),
  })
  .on('error', emitError)
  .pipe(JSONStream.parse())
  .on('error', emitError);

  stream.on('data', function(data) {
    _.flatten([data.query.results.quote]).forEach(function(quote) {
      if (!self.push(self._standardize(quote))) {
        self._running = false;
      }
    });
  });

  stream.on('end', function() {
    self._request = null;
    self._schedule();
  });
};


Stream.prototype._schedule = function(options) {
  var opts = _.defaults({}, options);

  // if immediate flag is given or was previously given, we ensure that it
  // sticks until the next successful run occurs. we do this by storing an
  // instance variable to track it across scheduling requests. either the
  // option flag or the instance variable being set indicates that both should
  // be set.
  if (this._immediate || opts.immediate) {
    this._immediate = opts.immediate = true;
  }

  // remove any existing timer
  clearTimeout(this._timer);

  var self = this;
  var timeout = opts.immediate ? 0 : this._options.frequency;
  var run = function() {
    if (self._canRun()) {
      self._run();
      self._immediate = false; // run started, clear immediate flag
    }
  };

  // schedule the timer only if we're actually running
  if (this._running) {
    this._timer = setTimeout(run, timeout);
  }
};

Stream.prototype._error = function(e) {
  this.emit('error', e);
  this.close();
};

Stream.prototype._read = function(/*size*/) {
  // mark this as running & schedule a timer to actually run. if this wasn't
  // already running, then we schedule the run for immediate execution.
  var wasRunning = this._running;
  this._running = true;
  this._schedule({ immediate: !wasRunning });
};

Stream.prototype.close = function() {
  var self = this;
  var close = function() {
    self._running = false;
    self._schedule();
    self.push(null);
  };

  if (this._request) { this._request.on('end', close); }
  else { close(); }
};

module.exports = Stream;
