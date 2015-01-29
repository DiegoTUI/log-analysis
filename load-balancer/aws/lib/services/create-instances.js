"use strict";

// requires
var fs = require("fs");
var AWS = require("aws-sdk");
var async = require("async");
var Log = require("log");
var config = require("../config.js");

// globals
var log = new Log(config.logLevel);
var ec2 = new AWS.EC2({accessKeyId: config.awsAccess,
                        secretAccessKey: config.awsSecret,
                        region: config.awsRegion});

/**
 * Creates one or several elasticsearch instances in the cluster and adds them to servers.json
 * @param params[optional] - the parameters of the request:
 *  - count[optional]: The number of instances to create. Defaults to 1.
 *  - addToLoadBalancer[optional]: A boolean indicating if the newly created instance should be added to servers.json. Defaults to false.
 * @param callback[required]: the function(error, result) to be called when done
 */
module.export = function (params, callback) {
    // init parameters
    params = typeof params === "function" ? {} : params;
    callback = callback || params;
    initParams();
    // build main stream
    var mainStream = buildMainStream();
    // run stream
    async.waterfall(mainStream, callback);

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
                        instanceId: instance.InstanceId,
                        privateIp: instance.PrivateIpAddress
                    };
                });
                return callback(null, response);
            });
        });
        // createTags
        mainStream.push(function (response, callback) {
            var instanceIds = response.map(function (instance) {
                return instance.instanceId;
            });
            log.debug("Instances created", instanceIds, "Tagging...");
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
        // wait for Instance Status OK
        mainStream.push(function (response, instanceIds, callback) {
            var waitForParams = {
                InstanceIds: instanceIds
            };
            log.debug("Waiting for instances", instanceIds, "to be ready.");
            ec2.waitFor("instanceStatusOk", waitForParams, function(error) {
                if (error) {
                    log.error("Error while waiting for instances to be ready:", error, error.stack);
                    return callback(error);
                }
                return callback(null, response);
            });
        });
        // add to servers.json (if params.addToLoadBalancer is true)
        if (params.addToLoadBalancer === true) {
            mainStream.push(function (response, callback) {
                log.debug("Adding instances to servers.json @" + config.serversJsonPath);
                fs.readFile(config.serversJsonPath, function (error, data) {
                    if (error) {
                        log.error("Could not open servers.json. The instances WERE NOT added to the load balancer.", error);
                        return callback(null, response);
                    }
                    var servers = JSON.parse(data);
                    response.forEach(function (instance) {
                        servers.push({
                            name: instance.name,
                            url: instance.privateIp
                        });
                    });
                    fs.writeFile(config.serversJsonPath, JSON.stringify(servers, null, 4), function(error) {
                        if (error) {
                            log.error("Could not write servers.json. The instances WERE NOT added to the load balancer.", error);
                        }
                        return callback(null, response);
                    });
                });
            });
        }
        return mainStream;
    }
};