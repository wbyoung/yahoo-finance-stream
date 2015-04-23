var express = require('express');
var app = express();
var util = require('util');
var EventEmitter = require('events').EventEmitter;

app.get('/', function(req, res) {
  app.requests.push(req);
  app.emit('req', req);
  res.send({ stocks: [] });
});

app.reset = function() {
  app.requests = [];
};

util.inherits(app, EventEmitter);

module.exports = app;
