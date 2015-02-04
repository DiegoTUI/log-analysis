"use strict";

/**
 * Services to manage AWS in ElasticSearch cluster.
 * (C) 2015 Diego Lafuente.
 */

exports["create-instance"] = require("./services/create-instance.js").Service;
exports["instance-status"] = require("./services/instance-status.js").Service;
exports["wait-for-instance-status-ok"] = require("./services/wait-for-instance-status-ok.js").Service;
exports["describe-instance"] = require("./services/describe-instance.js").Service;
exports["add-instance-haproxy"] = require("./services/add-instance-haproxy.js").Service;
exports["remove-instance-haproxy"] = require("./services/remove-instance-haproxy.js").Service;
exports["terminate-instance"] = require("./services/terminate-instance.js").Service;
exports["mirror-service"] = require("./services/mirror-service.js").Service;
