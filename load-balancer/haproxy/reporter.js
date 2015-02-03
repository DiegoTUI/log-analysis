"use strict";

// requires
var config = require("./config.js");
var moment = require("moment");
var AwsManager = require("./aws-manager.js");

// globals
var awsManager = new AwsManager();

/**
 * The reporter object receives reports from the haproxy regarding the status
 * of the servers being balanced, and takes decisions about it (starts/stops
 * servers, etc...)
 */

exports.Reporter = function() {
    // self reference
    var self = this;
    // the buffer of reports
    var buffer = {};
    // is reporting active?
    var shouldReport = true;

    /**
     * Receives a report
     * @param report: the list of objects to add to the buffer of reports
     */
    self.sendReports = function(reports) {
        if (!shouldReport || !reports || !(reports instanceof Array)) {
            return;
        }
        reports.forEach(function (report) {
            if (report && report.ip) {
                if (!buffer[report.ip] || !(buffer[report.ip] instanceof Array)) {
                    buffer[report.ip] = [];
                }
                buffer[report.ip].push(report);
            }
        });
        // trim buffer
        trim();
        // do something about it
        react();
    };

    /**
     * Trims the buffer to remove old/expired data.
     */
    function trim() {
        var now = moment();
        for (var ip in buffer) {
            // remove old entries
            for (var i=0; i<buffer[ip]; i++) {
                var report = buffer[ip][i];
                var then = moment(report.timestamp);
                if (now.diff(then, "milliseconds") > config.bufferReportSize*config.interval) {
                    buffer[ip].splice(i,1);
                    i--;
                }
            }
            // terminate server if the buffer is empty
            terminateInstance(ip);
        }
    }

    /**
     * Terminate machine and remove from buffer.
     */
    function terminateInstance(ip) {
        awsManager.terminateInstance(ip);
        // remove ip from buffer
        delete buffer[ip];
    }

    /**
     * React to the current state of things.
     */
     function react() {
        // we only check the servers with enough reports. We need the average for all those of the servers
        var activeAverage = getActiveAverage();
        // check if any of the elasticsearch_up is negative. If it is negative, terminate the machine
        activeAverage.forEach(function (report) {
            if (report.elasticsearch_up < 0) {
                terminateInstance(report.ip);
            }
        });
        // recalculate activeAverage
        activeAverage = getActiveAverage();
        // Get average of all the machines
        var totalAverage = activeAverage.reduce(function (previous, current, index) {
            return {
                cpu: (previous.cpu * index + current.cpu) / (index + 1),
                virtual_memory: (previous.virtual_memory * index + current.virtual_memory) / (index + 1),
                swap_memory: (previous.swap_memory * index + current.swap_memory) / (index + 1),
                disk_usage: (previous.disk_usage * index + current.disk_usage) / (index + 1)
            };
        });
        // add or remove machines
        if (shouldAdd()) {
            shouldReport = false;
            awsManager.launchInstance(function(error) {
                if (!error) {
                    buffer = {};
                }
                shouldReport = true;
            });

        } else if (shouldRemove()) {
            if (activeAverage.length > 1) {
                var removableMachines = activeAverage.filter(function (report) {
                    return report.name === config.ESNodeName;
                });
                if (removableMachines.length > 0) {
                    shouldReport = false;
                    awsManager.terminateInstance(removableMachines[0].ip);
                    buffer = {};
                    setTimeout(function(){
                        shouldReport = true;
                    }, config.interval);
                }
            }
        }

        function shouldAdd() {
            return false;
        }

        function shouldRemove() {
            return false;
        }
     }

    /**
     * Returns the buffer with enough (as defined in config.bufferReportSize) number of events
     */
     function getActiveAverage() {
        var activeAverage = [];
        // reducer
        function reducer(previous, current, index) {
            var previousElasticSearchIndex = typeof previous.elasticsearch_up === "number" ? previous.elasticsearch_up : (previous.elasticsearch_up ? 1 : -1);
            var currentElasticSearchIndex = current.elasticsearch_up ? 1 : -1;
            return {
                ip: previous.ip,
                name: previous.name,
                cpu: (previous.cpu * index + current.cpu) / (index + 1),
                virtual_memory: (previous.virtual_memory * index + current.virtual_memory) / (index + 1),
                swap_memory: (previous.swap_memory * index + current.swap_memory) / (index + 1),
                disk_usage: (previous.disk_usage * index + current.disk_usage) / (index + 1),
                elasticsearch_up: previousElasticSearchIndex + currentElasticSearchIndex
            };
        }
        for (var ip in buffer) {
            if (buffer[ip].length >= config.bufferReportSize) {
                activeAverage.push(buffer[ip].reduce(reducer));
            }
        }
        return activeAverage;
     }
};