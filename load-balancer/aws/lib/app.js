"use strict";

/**
 * Server for AWS services in ElasticSearch cluster.
 * (C) 2015 Diego Lafuente.
 */

// requires
var Log = require("log");
var express = require("express");
var timeout = require("connect-timeout");
var request = require("request");
var services = require("./services");
var config = require("../config.js");
var testing = require("testing");

// globals
var log = new Log(config.logLevel);
var server;
var bannedServices = [];

// process
process.title = "aws-server";
//uncaught exceptions
process.on("uncaughtException", function(err) {
    log.error("We found an uncaught exception.");
    log.error(err.stack);
    process.exit(0);
});

/**
 * Start server
 */
exports.startServer = function(port, callback) {
    if (typeof port == "function") {
        callback = port;
        port = config.serverPort;
    }
    var app = express();
    // set timeout
    app.use(timeout(exports.socketTimeout + "ms"));
    // Enable JSONP
    app.set("jsonp callback", true);
    // path to the services
    var pathToServices = "/:apiKey/:service";
    
    app.get(pathToServices, serve);

    server = app.listen(port, callback);

    server.on("connection", function(socket) {
        log.debug("New connection. Setting timeout.");
        socket.setTimeout(exports.socketTimeout);
    });
};

/**
 * Close the server.
 */
exports.closeServer = function(callback) {
    if (!server) {
        log.debug("No server to close");
        return callback(null);
    }
    server.close(function() {
        log.debug("Server closed");
        return callback(null);
    });
};

/**
 * HTTP server for GET requests
 */
function serve (request, response) {
    var responseToSend;
    var serviceName = request.params.service;
    var apiKey = request.params.apiKey;
    var Service = services[serviceName];
    // set response type
    response.set("Content-Type", "application/json");
    // check service
    if (typeof Service !== "function") {
        responseToSend = {
            status: "ERROR",
            error: "Unexisting service " + serviceName
        };
        return response.status(500).send(responseToSend);
    }
    // check if banned
    if (bannedServices.indexOf(serviceName) > -1) {
        responseToSend = {
            status: "ERROR",
            error: "Banned service " + serviceName
        };
        return response.status(500).send(responseToSend);
    }
    // check API key 
    if (apiKey != config.validApiKey) {
        responseToSend = {
            status: "ERROR",
            error: "Invalid API key"
        };
        return response.status(500).send(responseToSend);
    }
    // Everything ok, call service
    log.info("Calling " + serviceName + " with params " + JSON.stringify(request.query));
    var service = new Service(request.query);
    // add service to banned services
    if (config.timeoutServices.indexOf(serviceName) > -1) {
        bannedServices.push(serviceName);
        setTimeout(function() {
            var index = bannedServices.indexOf(serviceName);
            if (index > -1) {
                bannedServices.splice(index, 1);
            }
        }, config.millisecondsToWaitForTimeoutServices);
    }
    service.sendRequest(function (error, result) {
        if (error) {
            responseToSend = {
                status: "ERROR",
                error: serviceName + ": " + error
            };
            log.info("Error in request to " + serviceName + " with params " + JSON.stringify(request.query) + ". Error: " + error);
            return response.status(500).send(responseToSend);
        }
        responseToSend = {
            status: "OK",
            data: result
        };
        log.info("Success in request to " + serviceName + " with params " + JSON.stringify(request.query) + ". Result: " + JSON.stringify(result));
        return response.status(200).jsonp(responseToSend);
    });
}

/***********************************
 ************ UNIT TESTS ***********
 ***********************************/

function testInvalidApiKey(callback) {
    exports.startServer(config.serverPortTest, function (error) {
        testing.check(error, callback);
        var invalidAPIKey = "INVALID_API_KEY";
        request("http://localhost:" + config.serverPortTest + "/" + invalidAPIKey + "/mirror-service", function (error, response, body) {
            testing.check(error, callback);
            testing.assertEquals(response.statusCode, 500, "Invalid status code returned", callback);
            var parsedBody = JSON.parse(body);
            testing.assertEquals(parsedBody.status, "ERROR", "Invalid status returned in body", callback);
            testing.assertEquals(parsedBody.error, "Invalid API key", "Invalid error returned in body", callback);
            testing.check(parsedBody.data, callback);
            exports.closeServer(function() {
                testing.success(callback);
            });
        });
    });
}

function testUnexistingService(callback) {
    exports.startServer(config.serverPortTest, function (error) {
        testing.check(error, callback);
        var unexistingService = "UNEXISTING-SERVICE";
        request("http://localhost:" + config.serverPortTest + "/" + config.validApiKey + "/" + unexistingService, function (error, response, body) {
            testing.check(error, callback);
            testing.assertEquals(response.statusCode, 500, "Invalid status code returned", callback);
            var parsedBody = JSON.parse(body);
            testing.assertEquals(parsedBody.status, "ERROR", "Invalid status returned in body", callback);
            testing.assertEquals(parsedBody.error, "Unexisting service " + unexistingService, callback);
            testing.check(parsedBody.data, callback);
            exports.closeServer(function() {
                testing.success(callback);
            });
        });
    });
}

function testServiceReturningError(callback) {
    exports.startServer(config.serverPortTest, function (error) {
        testing.check(error, callback);
        var errorService = "error-service";
        request("http://localhost:" + config.serverPortTest + "/" + config.validApiKey + "/" + errorService, function (error, response, body) {
            testing.check(error, callback);
            testing.assertEquals(response.statusCode, 500, "Invalid status code returned", callback);
            var parsedBody = JSON.parse(body);
            testing.assertEquals(parsedBody.status, "ERROR", "Invalid status returned in body", callback);
            testing.assertEquals(parsedBody.error, errorService + ": error returned by error-service", callback);
            testing.check(parsedBody.data, callback);
            exports.closeServer(function() {
                testing.success(callback);
            });
        });
    });
}

function testMirrorService(callback) {
    exports.startServer(config.serverPortTest, function (error) {
        testing.check(error, callback);
        var mirrorService = "mirror-service";
        request("http://localhost:" + config.serverPortTest + "/" + config.validApiKey + "/" + mirrorService + "?a=1&b=2", function (error, response, body) {
            testing.check(error, callback);
            testing.assertEquals(response.statusCode, 200, "Invalid status code returned", callback);
            var parsedBody = JSON.parse(body);
            testing.check(parsedBody.error, callback);
            testing.assertEquals(parsedBody.status, "OK", "Invalid status returned in body", callback);
            testing.assertEquals(parsedBody.data.a, 1, "Unexpected response from mirror-service", callback);
            testing.assertEquals(parsedBody.data.b, 2, "Unexpected response from mirror-service", callback);
            exports.closeServer(function() {
                testing.success(callback);
            });
        });
    });
}


exports.test = function(callback) {
    // add a fake test services
    services["mirror-service"] = function(params) {
        this.sendRequest = function(callback) {
            return callback(null, params);
        };
    };
    services["error-service"] = function() {
        this.sendRequest = function(callback) {
            return callback("error returned by error-service");
        };
    };
    testing.run([
        testInvalidApiKey,
        testUnexistingService,
        testServiceReturningError,
        testMirrorService
    ], function (error, result) {
        delete services["mirror-service"];
        delete services["error-service"];
        callback(error, result);
    });
};

/**
 * Start server.
 * In this case tests are not run when invoking the file; use test.js for that.
 */
if (__filename == process.argv[1]) {
    exports.startServer(function() {
        log.info("Started server on port %s", config.serverPort);
    });
}