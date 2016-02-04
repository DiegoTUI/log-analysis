"use strict";

// requires
var config = require("./config.js");
var request = require("request");
var Log = require("log");

// globals
var log = new Log(config.logLevel);

/**
 * An object to manage AWS instances through the aws-service API REST
 */

exports.AwsManager = function() {
    // self reference
    var self = this;

    /**
     * Launches a new instance and adds it to the haproxy
     * @param callback, a function(error) that is called when the instance has been created and is added to the haproxy
     */
     self.launchInstance = function(callback) {
        // create instance
        log.info("Creating new instance...");
        request(config.awsServerUrl + "create-instance", function (error, response, body) {
            if (error || response.statusCode != 200) {
                log.error("Error in the create-instance response", error || (response.statusCode + " - " + response.body));
                return callback(true);
            }
            try {
                body  = JSON.parse(body);
            }
            catch(exception) {
                log.error("Could not parse create-instance response", body, exception);
                return callback(true);
            }
            if (body.status != "OK" || !body.data || body.data.length !== 1) {
                log.error("Faulty response in create-instance", body);
                return callback(true);
            }
            var instance = body.data[0];
            // wait 2 minutes and then wait for instance to be ok
            check();

            function check() {
                log.info("Waiting for instance " + instance.id + " to be ok. This could take time.");
                request(config.awsServerUrl + "wait-for-instance-status-ok?ids=" + instance.id, function(error, response, body) {
                    if (error || response.statusCode != 200) {
                        log.error("Error while waiting for instance to be ok", error || (response.statusCode + " - " + response.body));
                        return callback(true);
                    }
                    try {
                        body  = JSON.parse(body);
                    }
                    catch(exception) {
                        log.error("Could not parse wait-for-instance-status-ok response", body, exception);
                        return callback(true);
                    }
                    if (body.status != "OK" || !body.data || body.data.length !== 1) {
                        log.error("Faulty response in wait-for-instance-status-ok", body);
                        return callback(true);
                    }
                    log.info("Instance " + instance.id + " created. Adding to servers.json.");
                    // add instance to servers.json
                    request(config.awsServerUrl + "add-instance-haproxy?ips=" + instance.privateIp, function(error, response, body) {
                        if (error || response.statusCode != 200) {
                            log.error("Error while adding instance to haproxy", error || (response.statusCode + " - " + response.body));
                            return callback(true);
                        }
                        try {
                            body  = JSON.parse(body);
                        }
                        catch(exception) {
                            log.error("Could not parse add-instance-haproxy response", body, exception);
                            return callback(true);
                        }
                        if (body.status != "OK") {
                            log.error("Faulty response in add-instance-haproxy", body);
                            return callback(true);
                        }
                        //SUCCESS!!
                        log.info("Instance " + instance.id + " with ip " + instance.privateIp + " added to servers.json.");
                        return callback(null);
                    });
                });
            }
        });
    };

    /**
     * Terminates an instance with a given ip and removes it from servers.json. Check log for potential errors.
     */
    self.terminateInstance = function(ip, callback) {
        log.info("Terminating instance with ip: " + ip);
        // get instance id first
        request(config.awsServerUrl + "describe-instance?ips=" + ip, function(error, response, body) {
            if (error || response.statusCode != 200) {
                log.error("Error in the describe-instance response", error || (response.statusCode + " - " + response.body));
                return callback(true);
            }
            try {
                body  = JSON.parse(body);
            }
            catch(exception) {
                log.error("Could not parse describe-instance response", body, exception);
                return callback(true);
            }
            if (body.status != "OK" || !body.data || body.data.length !== 1 || !body.data[0].id) {
                log.error("Faulty response in describe-instance", body);
                return callback(true);
            }
            var instanceId = body.data[0].id;
            log.info("Instance with ip " + ip + " has id " + instanceId + ". Terminating...");
            // terminate instance
            request(config.awsServerUrl + "terminate-instance?ids=" + instanceId, function (error, response, body) {
                if (error || response.statusCode != 200) {
                    log.error("Error in the terminate-instance response", error || (response.statusCode + " - " + response.body));
                    return callback(true);
                }
                try {
                    body  = JSON.parse(body);
                }
                catch(exception) {
                    log.error("Could not parse terminate-instance response", body, exception);
                    return callback(true);
                }
                if (body.status != "OK" || !body.data || body.data.length !== 1 || body.data[0].id != instanceId) {
                    log.error("Faulty response in terminate-instance", body);
                    return callback(true);
                }
                request(config.awsServerUrl + "remove-instance-haproxy?ips=" + ip, function (error, response) {
                    if (error || response.statusCode != 200) {
                        log.error("Error in the remove-instance-haproxy response", error || (response.statusCode + " - " + response.body));
                        return callback(true);
                    }
                    log.info("Instance with ip " + ip + " and id " + instanceId + " has been terminated and removed from servers.json.");
                    return callback(null);
                });
            });
        });
    };
};
