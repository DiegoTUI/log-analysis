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
 * Waits until a number of instances are ok (InstanceStatus)
 * @param params[optional] - the parameters of the request:
 *  - ids[optional]: Comma separated list of the instances to wait for. It waits for all 
 * the instances to be OK if this paramenter is not provided.
 */
exports.Service = function (params) {
    // self-reference
    var self = this;
    // init parameters
    initParams();

    /**
     * Performs request
     * @param callback[required]: the function(error, result) to be called when done.
     * @return The result is an array of dictionaries with instance statuses:
     *  - id: the instance id
     *  - state: the instance state: "pending", "running", "shutting-down", "terminated", "stopping" or "stopped"
     *  - systemStatus: the system status in the instance: "passed", "failed" or "insufficient-data"
     */
    self.sendRequest = function(callback) {
        ec2.waitFor("instanceStatusOk",params, function (error, result) {
            if (error || !result || !result.InstanceStatuses || !(result.InstanceStatuses instanceof Array)) {
                log.error("Could not get instance(s) status", error, result);
                return callback("Could not get instance(s) status", error, result);
            }
            var response = result.InstanceStatuses.map(function (instanceStatus) {
                return {
                    id: instanceStatus.InstanceId,
                    state: instanceStatus.InstanceState.Name,
                    systemStatus: instanceStatus.SystemStatus.Status
                };
            });
            return callback(null, response);
        });
    };

    /**
     * Inits parameters
     */
    function initParams() {
        params = params || {};
        //instance ids
        if ("ids" in params) {
            params.InstanceIds = params.ids.split(",");
            delete params.ids;
        }
    }
};

/***********************************
 ************ UNIT TESTS ***********
 ***********************************/

function testEmptyParams(callback) {
    // stub ec2
    var ec2_restore = ec2;
    ec2 = {
        waitFor: function(waitForWhat, params, internalCallback) {
            testing.assertEquals(waitForWhat, "instanceStatusOk", "wrong thing to wait for", callback);
            testing.assertEquals(Object.keys(params).length, 0, "non-empty params sent to describeInstanceStatus", callback);
            internalCallback(null, {
                InstanceStatuses: [{
                    InstanceId: "testInstanceId",
                    InstanceState: {Name: "testInstanceState"},
                    SystemStatus: {Status: "testSystemStatus"}
                }]
            });
        }
    };
    // create and launch service
    var service = new exports.Service();
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of instance statuses returned", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong instance id returned", callback);
        testing.assertEquals(result[0].state, "testInstanceState", "wrong instance state returned", callback);
        testing.assertEquals(result[0].systemStatus, "testSystemStatus", "wrong system status returned", callback);
        //restore ec2
        ec2 = ec2_restore;
        testing.success(callback);
    });
}

function testValidParams(callback) {
    // stub ec2
    var ec2_restore = ec2;
    ec2 = {
        waitFor: function(waitForWhat, params, internalCallback) {
            testing.assertEquals(waitForWhat, "instanceStatusOk", "wrong thing to wait for", callback);
            testing.assertEquals(params.InstanceIds.length, 1, "wrong number of instance ids sent to describeInstanceStatus", callback);
            testing.assertEquals(params.InstanceIds[0], "testInstanceId", "wrong instance id sent to describeInstanceStatus", callback);
            return internalCallback(null, {
                InstanceStatuses: [{
                    InstanceId: "testInstanceId",
                    InstanceState: {Name: "testInstanceState"},
                    SystemStatus: {Status: "testSystemStatus"}
                }]
            });
        }
    };
    // create and launch service
    var service = new exports.Service({ids:"testInstanceId"});
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of instance statuses returned", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong instance id returned", callback);
        testing.assertEquals(result[0].state, "testInstanceState", "wrong instance state returned", callback);
        testing.assertEquals(result[0].systemStatus, "testSystemStatus", "wrong system status returned", callback);
        //restore ec2
        ec2 = ec2_restore;
        testing.success(callback);
    });
}

exports.test = function(callback) {
    testing.run([
        testEmptyParams,
        testValidParams
    ], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
    exports.test(testing.show);
}