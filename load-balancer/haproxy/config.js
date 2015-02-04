"use strict";

// requires
var Log = require("log");

// globals
var log = new Log("info");

exports.logLevel = "debug";

exports.haproxyConfig = "./config/haproxy.cfg";
exports.baseHaproxyConfig = "./base-haproxy.cfg";
exports.haproxyPidFile = "./run/haproxy.pid";

exports.interval = 60*1000;
exports.bufferReportSize = 5;

exports.awsServerUrl = "http://localhost:8080/yvalsd7bde93njbc67bd5/";
exports.ESNodeName = "ES-Node";

try {
    var localConfig = require("./local-config.js");
    for (var key in localConfig) {
        exports[key] = localConfig[key];
    }
} catch(exception) {
    log.notice("local-config.js not found");
}