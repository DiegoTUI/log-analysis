"use strict";

/**
 * Run package tests.
 * (C) 2015 Diego Lafuente.
 */

// requires
var testing = require("testing");

/**
 * Run all module tests.
 */
exports.test = function(callback) {
    var tests = [
        require("./lib/app.js").test,
        require("./lib/prototypes.js").test,
        require("./lib/services/create-instance.js").test,
        require("./lib/services/instance-status.js").test,
        require("./lib/services/describe-instance.js").test,
        require("./lib/services/terminate-instance.js").test,
        require("./lib/services/add-instance-haproxy.js").test
    ];

    testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
    exports.test(testing.show);
}