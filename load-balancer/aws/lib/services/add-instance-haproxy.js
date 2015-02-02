"use strict";

// requires
require("../prototypes.js");
var fs = require("fs");
var Log = require("log");
var config = require("../../config.js");
var testing = require("testing");

// globals
var log = new Log(config.logLevel);

/**
 * Adds one or several ips to the servers.json file
 * @param params[required] - the parameters of the request:
 *  - ips[required]: Comma separated list of the ips to add. All the instances will be named config.ESNameTag.
 * @param callback[required]: the function(error, result) to be called when done
 * @return The result is an array of dictionaries with ALL the ips currently in HAProxy:
 *  - name: the name of the server
 *  - url: the ip of the server
 */
exports.Service = function (params) {
    // self-reference
    var self = this;
    // compulsory paramaters
    var compulsoryParameters = ["ips"];
    // init parameters
    initParams();

    /**
     * Performs request
     */
    self.sendRequest = function(callback) {
        // check compulsory parameters
        if(!checkCompulsoryParameters()) {
            return callback ("Required parameter missing. Compulsory parameters for this service are: " + compulsoryParameters + ". The instances WERE NOT added to the load balancer.");
        }
        var ips = params.ips.split(",");
        for (var i=0; i<ips.length; i++) {
            if (!ips[i].isIpAddress()) {
                return callback("Malformed ip in query: " + ips[i] + ". The instances WERE NOT added to the load balancer.");
            }
        }
        fs.readFile(config.serversJsonPath, function (error, data) {
            if (error) {
                log.error("Could not open servers.json. The instances WERE NOT added to the load balancer.", error);
                return callback("Could not open servers.json. The instances WERE NOT added to the load balancer.", error);
            }
            var servers = JSON.parse(data);
            ips.forEach(function (ip) {
                servers.push({
                    name: config.ESNameTag,
                    url: ip
                });
            });
            fs.writeFile(config.serversJsonPath, JSON.stringify(servers, null, 4), function(error) {
                if (error) {
                    log.error("Could not write servers.json. The instances WERE NOT added to the load balancer.", error);
                    return callback("Could not write servers.json. The instances WERE NOT added to the load balancer.", error);
                }
                return callback(null, servers);
            });
        });
    };

    /**
     * Inits parameters
     */
    function initParams() {
        params = params || {};
    }

    /**
     * Checks compulsory parameters
     */
    function checkCompulsoryParameters() {
        var check = true;
        compulsoryParameters.forEach(function (parameter) {
            if (!params[parameter]) {
                log.debug("Compulsory parameter not found in service: " + parameter);
                check = false;
            }
        });
        return check;
    }
};

/***********************************
 ************ UNIT TESTS ***********
 ***********************************/
function testEmptyParams(callback) {
    // create and launch service
    var service = new exports.Service();
    service.sendRequest(function (error, result) {
        testing.assert(error, "empty params did NOT return an error", callback);
        testing.check(result, callback);
        testing.success(callback);
    });
}

function testInvalidParams(callback) {
    // create and launch service
    var service = new exports.Service({ips: "127.0.0.1,256.10.5.4"});
    service.sendRequest(function (error, result) {
        testing.assert(error, "invalid params did NOT return an error", callback);
        testing.check(result, callback);
        testing.success(callback);
    });
}

function testValidParams(callback) {
    // stub fs
    var restore_fs = fs;
    fs = {
        readFile: function(path, internalCallback) {
            testing.assertEquals(path, config.serversJsonPath, "invalid path used to read servers.json", callback);
            return internalCallback(null, "[]");
        },
        writeFile: function(path, data, internalCallback) {
            var dataJson = JSON.parse(data);
            testing.assertEquals(dataJson.length, 1, "wrong number of items returned after adding new servers", callback);
            testing.assertEquals(dataJson[0].name, config.ESNameTag, "wrong name of server after adding new servers", callback);
            testing.assertEquals(dataJson[0].url, "127.0.0.1", "wrong url of server after adding new servers", callback);
            return internalCallback(null);
        }
    };
    var service = new exports.Service({ips: "127.0.0.1"});
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of items returned after adding new servers", callback);
        testing.assertEquals(result[0].name, config.ESNameTag, "wrong name of server after adding new servers", callback);
        testing.assertEquals(result[0].url, "127.0.0.1", "wrong url of server after adding new servers", callback);
        // restore fs
        fs = restore_fs;
        testing.success(callback);
    });
}

exports.test = function(callback) {
    testing.run([
        testEmptyParams,
        testInvalidParams,
        testValidParams
    ], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
    exports.test(testing.show);
}