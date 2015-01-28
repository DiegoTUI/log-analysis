"use strict";

/**
 * Run a process that asks for status to the different backends.
 * (C) 2014 TuiInnovation.
 */

// requires
var HAProxy = require("haproxy");
var fs = require("fs");
var path = require("path");
var request = require("request");
var Log = require("log");
var config = require("./config.js");
var watch = require("node-watch");
var db = require("./db.js");

// globals
var log = new Log("debug");
var haproxy = new HAProxy ("/tmp/haproxy.sock", {config: path.resolve(__dirname, config.haproxyConfig),
                                                pidFile: path.resolve(__dirname, config.haproxyPidFile)});
var servers = null;
var monitoringCollection = null;

/**
 * Reset servers to whats in servers.json
 */
 function resetServers() {
    servers = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./servers.json")));
    // read base haproxy config file
    fs.readFile(path.resolve(__dirname, config.baseHaproxyConfig), "utf8", function (error, data) {
        if (error || !data) {
            return log.error ("couldn't read haproxy baseconfiguration file: " + config.baseHaproxyConfig);
        }
        // add servers
        var servers9200 = "#servers 9200";
        var servers9300 = "#servers 9300";
        servers.forEach(function (server) {
            data = data.slice(0, data.indexOf(servers9200) + servers9200.length) + "\n    server " + server.name + " " + server.url + ":9200 check" + data.slice(data.indexOf(servers9200) + servers9200.length);
            data = data.slice(0, data.indexOf(servers9300) + servers9300.length) + "\n    server " + server.name + " " + server.url + ":9300 check" + data.slice(data.indexOf(servers9300) + servers9300.length);
        });
        // write file
        fs.writeFile(path.resolve(__dirname, config.haproxyConfig), data, function (error) {
            if (error) {
                return log.error ("couldn't write haproxy configuration file: " + config.haproxyConfig);
            }
            // restart haproxy
            haproxy.reload(function (error) {
                if (error) {
                    return log.error ("couldn't reload haproxy with the new configuration: " + JSON.stringify(error));
                }
                log.info ("haproxy reloaded correctly");
            });
        });
    });
}

// capture exit process
process.on("exit", function() {
    log.info("about to exit");
});
process.on("SIGTERM", function() {
    log.info("SIGTERM");
    haproxy.softstop(function (error) {
        if (error) {
            log.error("Exiting: couldn't stop all instances of haproxy: " + JSON.stringify(error));
        }
        log.info("Exiting: all haproxy instances stopped");
	process.exit(1);
    });
});

// reset servers the first time the script is called
haproxy.softstop(function (error) {
    if (error) {
        log.error("Starting: couldn't stop all instances of haproxy: " + JSON.stringify(error));
    }
    resetServers();
});

// watch servers.json for changes
watch(path.resolve(__dirname, "servers.json"), function (filename) {
    log.debug (filename + " changed. Resetting haproxy");
    resetServers();
});

//read status from every server
setInterval(function () {
    servers.forEach(function (server) {
        var url = "http://" + server.url + "/status";
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                return log.info("Status of " + server.name + " (" + server.url + "): " + body);
            }
            // error
            log.error ("Could not get status from " + server.url + ". Error: " + JSON.stringify(error));
        });
    });
}, config.interval);
