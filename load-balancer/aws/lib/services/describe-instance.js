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
 * Returns the description of one or several AWS instances
 * @param params[optional] - the parameters of the request:
 *  - ips[optional]: Comma separated list of the internal ips of the instances to describe. It returns the description of all 
 * the instances if this paramenter is not provided.
 * @param callback[required]: the function(error, result) to be called when done.
 * @return The result is an array of dictionaries with instance statuses:
 *  - id: the instance id
 *  - state: the instance state: "pending", "running", "shutting-down", "terminated", "stopping" or "stopped"
 *  - type: the type of the instance: "t1.micro", "m1.small", etc...
 */
exports.Service = function (params) {
    // self-reference
    var self = this;
    // init parameters
    initParams();

    /**
     * Performs request
     */
    self.sendRequest = function(callback) {
        ec2.describeInstances(params, function (error, result) {
            if (error || !result || !result.Reservations || !(result.Reservations instanceof Array)) {
                log.error("Could not get description of instance(s)", error, result);
                return callback("Could not get description of instance(s)", error, result);
            }
            var response = [];
            result.Reservations.forEach(function (reservation) {
                if (reservation.Instances && reservation.Instances instanceof Array) {
                    response = response.concat(reservation.Instances.map(function (instance) {
                        return {
                            id: instance.InstanceId,
                            state: instance.State.Name,
                            type: instance.InstanceType
                        };
                    }));
                }
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
        if ("ips" in params) {
            params.Filters = [{
                Name: "private-ip-address",
                Values: params.ips.split(",")
            }];
            delete params.ips;
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
        describeInstances: function(params, internalCallback) {
            testing.assertEquals(Object.keys(params).length, 0, "non-empty params sent to describeInstance", callback);
            return internalCallback(null, {
                Reservations: [{
                    Instances: [{
                        InstanceId: "testInstanceId",
                        State: {Name: "testInstanceState"},
                        InstanceType: "testInstanceType",
                    }]
                }]
            });
        }
    };
    // create and launch service
    var service = new exports.Service();
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of instance descriptions returned", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong instance id returned", callback);
        testing.assertEquals(result[0].state, "testInstanceState", "wrong instance state returned", callback);
        testing.assertEquals(result[0].type, "testInstanceType", "wrong instance type returned", callback);
        //restore ec2
        ec2 = ec2_restore;
        testing.success(callback);
    });
}

function testValidParams(callback) {
    // stub ec2
    var ec2_restore = ec2;
    ec2 = {
        describeInstances: function(params, internalCallback) {
            testing.assertEquals(Object.keys(params).length, 1, "only the Filters key should be included in params to send to describeInstance", callback);
            testing.assertEquals(params.Filters.length, 1, "wrong number of filters sent to describeInstance", callback);
            testing.assertEquals(params.Filters[0].Name, "private-ip-address", "wrong filter name sent to describeInstance", callback);
            testing.assertEquals(params.Filters[0].Values.length, 1, "wrong number of values in filter sent to describeInstance", callback);
            testing.assertEquals(params.Filters[0].Values[0], "testIps", "wrong value in filter sent to describeInstance", callback);
            return internalCallback(null, {
                Reservations: [{
                    Instances: [{
                        InstanceId: "testInstanceId",
                        State: {Name: "testInstanceState"},
                        InstanceType: "testInstanceType",
                    }]
                }]
            });
        }
    };
    // create and launch service
    var service = new exports.Service({ips: "testIps"});
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of instance descriptions returned", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong instance id returned", callback);
        testing.assertEquals(result[0].state, "testInstanceState", "wrong instance state returned", callback);
        testing.assertEquals(result[0].type, "testInstanceType", "wrong instance type returned", callback);
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