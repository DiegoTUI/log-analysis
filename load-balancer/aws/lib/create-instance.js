"use strict";

var AWS = require("aws-sdk");
var Log = require("log");
var config = require("../config.js");

// globals
var log = new Log(config.logLevel);
var ec2 = new AWS.EC2({accessKeyId: config.awsAccess,
                        secretAccessKey: config.awsSecret,
                        region: config.awsRegion});
var runInstancesParams = {
    ImageId: config.ESImageId,
    MaxCount: 1,
    MinCount: 1,
    InstanceType: config.ESInstanceType,
    Placement: {
        AvailabilityZone: config.ESAvailabilityZone
    },
    SecurityGroupIds: config.ESSecurityGroupIds
};

// create instance!!
ec2.runInstances(runInstancesParams, function(error, result) {
    if (error) {
        return log.error("Could not create instance", error);
    }

    var instance = result.Instances[0];
    var instanceId = instance.InstanceId;
    var privateIp = instance.PrivateIpAddress;
    log.info("Created instance", instanceId, privateIp);

    // Add tags to the instance
    var createTagsParams = {
        Resources: [instanceId],
        Tags: [
            {Key: "Name", Value: config.ESNameTag},
            {Key: "Group", Value: config.ESGroupTag}
        ]
    };

    ec2.createTags(createTagsParams, function(error) {
        log.info("Tagging instance", error ? "failure" : "success");
    });

    var waitForParams = {
        InstanceIds: [instanceId]
    };
    ec2.waitFor("instanceStatusOk", waitForParams, function(error, result) {
        if (error) {
            log.error(error, error.stack); // an error occurred
        }
        else {
            log.info(JSON.stringify(result));           // successful response
        }
    });
});
