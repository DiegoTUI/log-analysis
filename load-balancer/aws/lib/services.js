"use strict";

/**
 * Services to manage AWS in ElasticSearch cluster.
 * (C) 2015 Diego Lafuente.
 */

exports["create-instance"] = require("./services/create-instance.js");
exports["instance-status"] = require("./services/instance-status.js");
exports["add-instance-haproxy"] = require("./services/add-instance-haproxy.js");
exports["mirror-service"] = require("./services/mirror-service.js");
