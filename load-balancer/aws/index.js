"use strict";

/**
 * Start server in single process mode mode.
 * (C) 2015 Diego Lafuente.
 */

 // requires
var app = require("./lib/app.js");
var Log = require("log");
var config = require("./config.js");

// globals
var log = new Log(config.logLevel);

// init
app.startServer(function() {
    log.info("Listening in single process mode");
});