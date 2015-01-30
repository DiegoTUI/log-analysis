"use strict";

// requires
var AWS = require("aws-sdk");
var Log = require("log");
var config = require("../../config.js");

// globals
var log = new Log(config.logLevel);
var ec2 = new AWS.EC2({accessKeyId: config.awsAccess,
                        secretAccessKey: config.awsSecret,
                        region: config.awsRegion});

/**
 * Returns the status of one or several AWS instances
 * @param params[optional] - the parameters of the request:
 *  - ids[optional]: Comma separated list of the instances to describe. It returns the status of all 
 * the instances if this paramenter is not provided.
 * @param callback[required]: the function(error, result) to be called when done.
 * @return The result is an array of dictionaries with instance statuses:
 *  - id: the instance id
 *  - state: the instance state: "pending", "running", "shutting-down", "terminated", "stopping" or "stopped"
 *  - status: the instance status: "ok", "impaired", "insufficient-data" or "not-applicable"
 *  - systemStatus: the system status in the instance: "passed", "failed" or "insufficient-data"
 */
module.exports = function (params) {
    // self-reference
    var self = this;
    // init parameters
    initParams();

    /**
     * Performs request
     */
    self.sendRequest = function(callback) {
        ec2.describeInstanceStatus(params, function (error, result) {
            if (error || !result || !result || !result.InstanceStatuses || !(result.InstanceStatuses instanceof Array)) {
                log.error("Could not get instance(s) status", error, result);
                return callback("Could not get instance(s) status", error, result);
            }
            var response = result.InstanceStatuses.map(function (instanceStatus) {
                return {
                    id: instanceStatus.InstanceId,
                    state: instanceStatus.InstanceState.Name,
                    status: instanceStatus.InstanceStatus.Status,
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