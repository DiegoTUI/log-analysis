"use strict";

/*
 * Prototype changes.
 * Modify javascript prototypes and global functions.
 *
 * Copyright (C) 2015 Diego Lafuente.
 */

var testing = require("testing");

/**
 * Turns a file-like string ("create-instances") into a function name like string ("createInstances")
 */
String.prototype.servify = function () {
    var words = this.split("-");
    for (var i = 1; i < words.length; i++ ) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }
    return words.join("");
};

/**
 * Checks if a string is a valid JSON
 */
String.prototype.isJson = function () {
    try {
        JSON.parse(this);
    } catch (e) {
        return false;
    }
    return true;
};

/***********************************
 ************ UNIT TESTS ***********
 ***********************************/

function testServify(callback) {
    testing.assertEquals(String.prototype.servify.apply("doSomething"), "doSomething", "servify fails if no dash", callback);
    testing.assertEquals(String.prototype.servify.apply("create-instances"), "createInstances", "servify fails with one dash", callback);
    testing.assertEquals(String.prototype.servify.apply("create-instances-now"), "createInstancesNow", "servify fails with two dashes", callback);
    testing.success(callback);
}

function testIsJson(callback) {
    var validJson = "{\"holy\":\"crap\"}";
    var invalidJson = "{'holy':'crap'}";
    testing.assertEquals(String.prototype.isJson.apply(validJson), true, "isJson failed with valid json", callback);
    testing.assertEquals(String.prototype.isJson.apply(invalidJson), false, "isJson failed with invalid json", callback);
    testing.success(callback);
}

exports.test = function(callback) {
    testing.run([
        testServify,
        testIsJson
    ], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1]) {
    exports.test(testing.show);
}