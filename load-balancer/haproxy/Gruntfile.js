"use strict";

module.exports = function(grunt) {
    grunt.initConfig({
        jshint: {
            files: [
                "*.js"
            ],
            options: {
                // use closest-through-parent jshint configuration file
                jshintrc: true
            }
        }
    });
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.registerTask("default", ["jshint"]);
};