"use strict";


exports.Service = function (params) {
    var self = this;

    self.sendRequest = function (callback) {
        callback(null, params);
    };

    return self;
};