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

// globals
var log = new Log("debug");
var haproxy = new HAProxy ("/tmp/haproxy.sock", {config: path.resolve(__dirname, config.haproxyConfig),
                                                pidFile: path.resolve(__dirname, config.haproxyPidFile)});
var servers = null;

/**
 * Reset config file to what is in servers.json
 */
 function resetConfigFile(callback) {
    servers = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./servers.json")));
    // read base haproxy config file
    fs.readFile(path.resolve(__dirname, config.baseHaproxyConfig), "utf8", function (error, data) {
        if (error || !data) {
            return callback("couldn't read haproxy baseconfiguration file: " + config.baseHaproxyConfig);
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
                return callback ("couldn't write haproxy configuration file: " + config.haproxyConfig);
            }
            return callback(null);
        });
    });
}

/**
 * Stop running instance of HAProxy
 */
function stopHAProxy(callback) {
    // try soft stop
    haproxy.softstop(function(error) {
        if (error) {
            log.info("Could not SOFTstop running HAProxies. Trying hard stop: " + JSON.stringify(error));
            return haproxy.stop(true, function(error) {
                if (error) {
                    return callback("Could not stop HAProxies SOFT or HARD: " + JSON.stringify(error));
                }
                return callback(null);
            });
        }
        return callback(null);
    });
}

/**
 * Start an instance of HAProxy
 */
function startHAProxy(callback) {
    haproxy.start(function(error) {
        if (error) {
            return callback("Could not start HAProxy instance: " + JSON.stringify(error));
        }
        return callback(null);
    });
}

/**
 * Resets the config file, stops and starts HAProxy 
 */
function reloadHAProxyVeryHard(callback) {
    resetConfigFile(function (error) {
        if (error) {
            return callback("Reload - Error while trying to reset config file: " + error);
        }
        stopHAProxy(function (error) {
            if (error) {
                return callback("Reload - Error while trying to stop all instances of HAProxy: " + error);
            }
            startHAProxy(function (error) {
                if (error) {
                    return callback("Reload - Error while trying to start HAProxy: " + error);
                }
                return callback(null);
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
    stopHAProxy(function (error) {
        if (error) {
            log.error("Exiting: couldn't stop all instances of haproxy: " + JSON.stringify(error));
            process.exit(0);
        }
        log.info("Exiting: all haproxy instances stopped");
	process.exit(1);
    });
});

// Stop and start everything
log.info("Starting HAProxy script...");
stopHAProxy(function (error) {
    if (error) {
        log.error("Error while trying to stop all instances of HAProxy: " + error);
    }
    else {
        log.info("All instances stopped");
    }
    resetConfigFile(function (error) {
        if (error) {
            log.error("Error while trying to reset config file: " + error);
        }
        else {
            log.info("Config file reset");
        }
        startHAProxy(function (error) {
            if (error) {
                log.error("Error while trying to start HAProxy: " + error);
            }
            else {
                log.info("HAProxy started");
            }
        });
    });
});

// watch servers.json for changes
watch(path.resolve(__dirname, "servers.json"), function (filename) {
    log.debug (filename + " changed. Reloading haproxy.");
    haproxy.reload(function (error) {
        if (error) {
            log.error("Error with soft reloading. Trying hard: " + error)
            return haproxy.reload(true, function (error) {
                if (error) {
                    log.error("Error with hard reloading. Trying harder: " + error)
                    return reloadHAProxyVeryHard(function (error) {
                        if (error) {
                            return log.error("It's impossible to reload this crap: " + error);
                        }
                        return log.info("HAProxy reloaded correctly. Very hard.");
                    });
                }
                return log.info("HAProxy reloaded correctly. Hard.");
            });
        }
        return log.info("HAProxy reloaded correctly.");
    });
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
