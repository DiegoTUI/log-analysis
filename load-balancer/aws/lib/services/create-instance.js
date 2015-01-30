"use strict";

// requires
var AWS = require("aws-sdk");
var async = require("async");
var Log = require("log");
var config = require("../../config.js");

// globals
var log = new Log(config.logLevel);
var ec2 = new AWS.EC2({accessKeyId: config.awsAccess,
                        secretAccessKey: config.awsSecret,
                        region: config.awsRegion});

/**
 * Creates one or several elasticsearch instances in the cluster and adds them to servers.json
 * @param params[optional] - the parameters of the request:
 *  - count[optional]: The number of instances to create. Defaults to 1.
 * @param callback[required]: the function(error, result) to be called when done. 
 * The instances ARE NOT OPERATIVE when the callback is returned. You will have to call the instance-status 
 * service or check the AWS console to check when they are ready to use.
 * @return The result is an array of dictionaries with the instances being created:
 *  - name: the instance name
 *  - id: the instance id
 *  - privateIp: the instance private IP
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
        // build main stream
        var mainStream = buildMainStream();
        // run stream
        async.waterfall(mainStream, callback);
    };

    /**
     * Inits parameters
     */
    function initParams() {
        params = params || {};
        //number of instances
        params.count = params.count || 1;
        params.MaxCount = params.count;
        params.MinCount = params.count;
        delete params.count;
        // rest of parameters
        params.ImageId = config.ESImageId;
        params.InstanceType = config.ESInstanceType;
        params.Placement = {
            AvailabilityZone: config.ESAvailabilityZone
        };
        params.SecurityGroupIds = config.ESSecurityGroupIds;
    }

    /**
     * Builds mainstream for async
     */
    function buildMainStream() {
        var mainStream = [];
        // runInstances
        mainStream.push(function (callback) {
            ec2.runInstances(params, function(error, result) {
                if (error) {
                    log.error("Could not create instance", error);
                    return callback(error);
                }
                var instances = result.Instances;
                var response = instances.map(function (instance) {
                    return {
                        name: config.ESNameTag,
                        id: instance.InstanceId,
                        privateIp: instance.PrivateIpAddress
                    };
                });
                return callback(null, response);
            });
        });
        // createTags
        mainStream.push(function (response, callback) {
            var instanceIds = response.map(function (instance) {
                return instance.id;
            });
            log.debug("Instances being created", instanceIds, "Tagging...");
            var createTagsParams = {
                Resources: instanceIds,
                Tags: [
                    {Key: "Name", Value: config.ESNameTag},
                    {Key: "Group", Value: config.ESGroupTag}
                ]
            };
            ec2.createTags(createTagsParams, function(error) {
                if (error) {
                    log.error("Could not tag instances " + instanceIds + ". PLEASE DO IT MANUALLY. Add the following tags: {\"Name\":\"" + config.ESNameTag + "\"} and {\"Group\":\"" + config.ESGroupTag + "\"}");
                }
                return callback(null, response, instanceIds);
            });
        });
        return mainStream;
    }
};