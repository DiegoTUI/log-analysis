"use strict";

// requires
var Log = require("log");

// globals
exports.logLevel = "info";
var log = new Log(exports.logLevel);

// AWS credentials and region
exports.awsAccess = null; // to be defined in local-config.js
exports.awsSecret = null; // to be defined in local-config.js
exports.awsRegion = "eu-west-1";
// Features of the ElasticSearch nodes
exports.ESImageId = "ami-73bb3704";
exports.ESSecurityGroupIds = ["sg-76198013", "sg-23e27946"];
exports.ESNameTag = "ES-Node";
exports.ESGroupTag = "ES-Cluster";
exports.ESInstanceType = "t2.medium";
exports.ESAvailabilityZone = "eu-west-1a";
// HAProxy
exports.serversJsonPath = "/home/ubuntu/haproxy/servers.json";
// Server
exports.serverPort = 8080;
exports.serverPortTest = 5054;
exports.validApiKey = "yvalsd7bde93njbc67bd5";

try {
    var localConfig = require("./local-config.js");
    for (var key in localConfig) {
        exports[key] = localConfig[key];
    }
} catch(exception) {
    log.notice("local-config.js not found");
}