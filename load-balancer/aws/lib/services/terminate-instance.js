"use strict";

// requires
var AWS = require("aws-sdk");
var Log = require("log");
var config = require("../../config.js");
var testing = require("testing");

// globals
var log = new Log(config.logLevel);
var ec2 = new AWS.EC2({accessKeyId: config.awsAccess,
                        secretAccessKey: config.awsSecret,
                        region: config.awsRegion});

/**
 * Terminates one or several AWS instances
 * @param params[required] - the parameters of the request:
 *  - ids[required]: Comma separated list of the ids of the instances to terminate. 
 * @param callback[required]: the function(error, result) to be called when done.
 * The instances ARE NOT TERMINATED when the callback is returned. You will have to call the instance-status 
 * service or check the AWS console to check when they are actually terminated.
 * @return The result is an array of dictionaries with the instances being terminated:
 *  - id: the instance id
 */
exports.Service = function (params) {
    // self-reference
    var self = this;
    // compulsory paramaters
    var compulsoryParameters = ["ids"];
    // init parameters
    initParams();

    /**
     * Performs request
     */
    self.sendRequest = function(callback) {
        // check compulsory parameters
        if(Object.keys(params).length === 0) {
            return callback ("Required parameter missing. Compulsory parameters for this service are: " + compulsoryParameters + ". The instances WERE NOT terminated.");
        }
        ec2.terminateInstances(params, function(error, result) {
            if (error || !result || !result.TerminatingInstances || !(result.TerminatingInstances instanceof Array)) {
                log.error("Could not terminate instance(s)", error, result);
                return callback("Could not terminate instance(s)", error, result);
            }
            var response = result.TerminatingInstances.map(function (instance) {
                return {
                    id: instance.InstanceId
                };
            });
            return callback(null, response);
        });
    };

    /**
     * Inits parameters
     */
    function initParams() {
        params = checkCompulsoryParameters() ? params : {};
        //instance ids
        if ("ids" in params) {
            params.InstanceIds = params.ids.split(",");
            delete params.ids;
        }
    }

    /**
     * Checks compulsory parameters
     */
    function checkCompulsoryParameters() {
        params = params || {};
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
    var service = new exports.Service({kkfu: 3});
    service.sendRequest(function (error, result) {
        testing.assert(error, "invalid params did NOT return an error", callback);
        testing.check(result, callback);
        testing.success(callback);
    });
}

function testValidParams(callback) {
    // stub ec2
    var restore_ec2 = ec2;
    ec2 = {
        terminateInstances: function(params, internalCallback) {
            testing.assertEquals(Object.keys(params).length, 1, "only the InstancesIds key should be included in params", callback);
            testing.assertEquals(params.InstanceIds.length, 1, "wrong number of instance ids sent ", callback);
            testing.assertEquals(params.InstanceIds[0], "testInstanceId", "wrong instance id sent", callback);
            return internalCallback(null, {
                TerminatingInstances: [{
                    InstanceId: "testInstanceId"
                }]
            });
        }
    };
    var service = new exports.Service({ids: "testInstanceId"});
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of items returned", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong instance id returned", callback);
        // restore fs
        ec2 = restore_ec2;
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