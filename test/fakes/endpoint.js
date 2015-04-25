var express = require('express');
var app = express();
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var responses = {
  '"VTI"': require('./vti'),
  '"VTI","VXUS"': require('./vti-vxus'),
  '"VXUS","VTI"': require('./vti-vxus'),
}

app.get('/', function(req, res) {
  app.requests.push(req);
  app.emit('req', req);

  var regex = /select.*where symbol in \(([A-Z",]+)\)/;
  var q = req.query.q.match(regex);
  var key = q && q[1];
  var response = responses[key];

  if (response) { res.send(response); }
  else { res.status(404).send({ error: 'not found' }); }
});

app.reset = function() {
  app.requests = [];
  app.removeAllListeners('req');
};

util.inherits(app, EventEmitter);

module.exports = app;
