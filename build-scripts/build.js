/*Copyright 2019 Steven Fontaine

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

var fs = require('fs');
var browserify = require('browserify');
var watchify = require('watchify');
var tsify = require('tsify');
var babelify = require('babelify');
var liveServer = require("live-server");

var watch = process.argv[2] === '-w';
var serve = process.argv[2] === '-s';

if (serve) {
    var params = {
        port: 8000,
        host: 'localhost',
        open: '/calc-ts.html',
        watch: ['./calc-ts.html', './calc.css', './dropdown.css', './dist.js'],
        logLevel: 2,
        wait: 1000
    };
    liveServer.start(params);
} else {
    var plugins = [tsify];
    if (watch) {
        plugins.push(watchify);
    }

    var b = browserify({
        entries: ['src/init.ts'],
        plugin: plugins,
        cache: {},
        packageCache: {}
    });

    b.transform(babelify, {
        extensions: ['.tsx', '.ts']
    });

    b.on('update', bundle);
    b.on('log', console.log);
    bundle();

    function bundle() {
        b.bundle().on('error', console.error).pipe(fs.createWriteStream('dist.js'));
    }
}
