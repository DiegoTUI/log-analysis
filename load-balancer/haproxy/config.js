"use strict";

// requires
var Log = require("log");

// globals
var log = new Log("info");

exports.haproxyConfig = "./config/haproxy.cfg";
exports.baseHaproxyConfig = "./base-haproxy.cfg";
exports.haproxyPidFile = "./run/haproxy.pid";

exports.interval = 5*60*1000;

try {
    var localConfig = require("./local-config.js");
    for (var key in localConfig) {
        exports[key] = localConfig[key];
    }
} catch(exception) {
    log.notice("local-config.js not found");
}