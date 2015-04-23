var express = require('express');
var app = express();

app.get('/', function(req, res) {
  app.requests.push(req);
  res.send({ stocks: [] });
});

app.reset = function() {
  app.requests = [];
};

module.exports = app;
