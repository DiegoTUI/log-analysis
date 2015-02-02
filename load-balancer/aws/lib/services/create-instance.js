"use strict";

// requires
var AWS = require("aws-sdk");
var async = require("async");
var Log = require("log");
var config = require("../../config.js");
var testing = require("testing");

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
exports.Service = function (params) {
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
                return callback(null, response);
            });
        });
        return mainStream;
    }
};

/***********************************
 ************ UNIT TESTS ***********
 ***********************************/

function testEmptyParams(callback) {
    // stub ec2
    var ec2_restore = ec2;
    ec2 = {
        runInstances: function(params, internalCallback) {
            testing.assertEquals(params.MinCount, 1, "invalid MinCount sent to runInstances", callback);
            testing.assertEquals(params.MaxCount, 1, "invalid MaxCount sent to runInstances", callback);
            testing.assertEquals(params.ImageId, config.ESImageId, "invalid ImageId sent to runInstances", callback);
            testing.assertEquals(params.InstanceType, config.ESInstanceType, "invalid InstanceType sent to runInstances", callback);
            testing.assertEquals(params.Placement.AvailabilityZone, config.ESAvailabilityZone, "invalid AvailabilityZone sent to runInstances", callback);
            testing.assertEquals(params.SecurityGroupIds.length, config.ESSecurityGroupIds.length, "invalid number of SecurityGroup ids sent to runInstances", callback);
            for (var i=0; i<params.SecurityGroupIds.length; i++) {
                testing.assertEquals(params.SecurityGroupIds[i], config.ESSecurityGroupIds[i], "invalid SecurityGroupId sent to runInstances", callback);
            }
            internalCallback(null, {Instances:[{
                InstanceId: "testInstanceId",
                PrivateIpAddress : "testPrivateIp"
            }]});
        },
        createTags: function(params, callback) {
            testing.assertEquals(params.Resources.length, 1, "wrong number of instances sent to createTags", callback);
            testing.assertEquals(params.Resources[0], "testInstanceId", "wrong instanceId sent to createTags", callback);
            testing.assertEquals(params.Tags.length, 2, "wrong number of tags sent to createTags", callback);
            testing.assertEquals(params.Tags[0].Key, "Name", "wrong first tag key sent to createTags", callback);
            testing.assertEquals(params.Tags[0].Value, config.ESNameTag, "wrong first tag value sent to createTags", callback);
            testing.assertEquals(params.Tags[1].Key, "Group", "wrong second tag key sent to createTags", callback);
            testing.assertEquals(params.Tags[1].Value, config.ESGroupTag, "wrong second tag value sent to createTags", callback);
            callback(null);
        }
    };
    // create and launch service
    var service = new exports.Service();
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 1, "wrong number of instances returned", callback);
        testing.assertEquals(result[0].name, config.ESNameTag, "wrong name for created instance", callback);
        testing.assertEquals(result[0].id, "testInstanceId", "wrong id for created instance", callback);
        testing.assertEquals(result[0].privateIp, "testPrivateIp", "wrong private ip for created instance", callback);
        //restore ec2
        ec2 = ec2_restore;
        testing.success(callback);
    });
}

function testValidParams(callback) {
    // stub ec2
    var ec2_restore = ec2;
    ec2 = {
        runInstances: function(params, internalCallback) {
            testing.assertEquals(params.MinCount, 2, "invalid MinCount sent to runInstances", callback);
            testing.assertEquals(params.MaxCount, 2, "invalid MaxCount sent to runInstances", callback);
            testing.assertEquals(params.ImageId, config.ESImageId, "invalid ImageId sent to runInstances", callback);
            testing.assertEquals(params.InstanceType, config.ESInstanceType, "invalid InstanceType sent to runInstances", callback);
            testing.assertEquals(params.Placement.AvailabilityZone, config.ESAvailabilityZone, "invalid AvailabilityZone sent to runInstances", callback);
            testing.assertEquals(params.SecurityGroupIds.length, config.ESSecurityGroupIds.length, "invalid number of SecurityGroup ids sent to runInstances", callback);
            for (var i=0; i<params.SecurityGroupIds.length; i++) {
                testing.assertEquals(params.SecurityGroupIds[i], config.ESSecurityGroupIds[i], "invalid SecurityGroupId sent to runInstances", callback);
            }
            return internalCallback(null, {Instances:[{
                InstanceId: "testInstanceId1",
                PrivateIpAddress : "testPrivateIp1"
            }, {

                InstanceId: "testInstanceId2",
                PrivateIpAddress : "testPrivateIp2"
            }]});
        },
        createTags: function(params, callback) {
            testing.assertEquals(params.Resources.length, 2, "wrong number of instances sent to createTags", callback);
            testing.assertEquals(params.Resources[0], "testInstanceId1", "wrong instanceId sent to createTags", callback);
            testing.assertEquals(params.Resources[1], "testInstanceId2", "wrong instanceId sent to createTags", callback);
            testing.assertEquals(params.Tags.length, 2, "wrong number of tags sent to createTags", callback);
            testing.assertEquals(params.Tags[0].Key, "Name", "wrong first tag key sent to createTags", callback);
            testing.assertEquals(params.Tags[0].Value, config.ESNameTag, "wrong first tag value sent to createTags", callback);
            testing.assertEquals(params.Tags[1].Key, "Group", "wrong second tag key sent to createTags", callback);
            testing.assertEquals(params.Tags[1].Value, config.ESGroupTag, "wrong second tag value sent to createTags", callback);
            return callback(null);
        }
    };
    // create and launch service
    var service = new exports.Service({count: 2});
    service.sendRequest(function (error, result) {
        testing.check(error, callback);
        testing.assertEquals(result.length, 2, "wrong number of instances returned", callback);
        testing.assertEquals(result[0].name, config.ESNameTag, "wrong name for created instance 1", callback);
        testing.assertEquals(result[0].id, "testInstanceId1", "wrong id for created instance 1", callback);
        testing.assertEquals(result[0].privateIp, "testPrivateIp1", "wrong private ip for created instance 1", callback);
        testing.assertEquals(result[1].name, config.ESNameTag, "wrong name for created instance 2", callback);
        testing.assertEquals(result[1].id, "testInstanceId2", "wrong id for created instance 2", callback);
        testing.assertEquals(result[1].privateIp, "testPrivateIp2", "wrong private ip for created instance 2", callback);
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