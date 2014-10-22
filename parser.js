//
// Copyright (c) 2014 Babbage Consulting Ltd
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';
var fs = require('fs');
var _ = require('underscore/underscore.js');
var program = require('commander');
var Parse = require('parse').Parse;

var parser = require('./fileParser.js').parser;

// Regexps of Files we won't look at.
var exclusions = ['ERROR.json', '_Product.json', '_Installation.json', '_Join*', 'INFO.json', 'AdminObject.json', '_Role.json'];

var verbose = false;

main();

function main(){

	program
	  .version('0.0.1')
	  .option('-v, --verbose', 'Verbose output')
	  .option('-d, --directory <path>', 'Path to search for files [.]', '.')
	  .option('-j, --js-key <key>', 'Parse Javasccript key [SZ4Am...]')
	  .option('-a, --app-id <key>', 'Parse app id [SZ4Am...]')
	  .parse(process.argv);


	if(typeof (program.jsKey) === 'undefined' || typeof (program.appId) === 'undefined' ) {
		console.log("Missing keys - you must provide a Parse Javascript key and an applicationID")
		program.help();
	}

	if(program.verbose){
		verbose = true;
		console.log("Verbose output");
	}

	if(verbose){
		console.log("reading from " + program.directory)
	}

	var dir = program.directory;

	var files = fs.readdirSync(dir);
	parser.setVerboseMode(verbose);

	// Construct a regexp of all the members of exclusion array.
	var exclusionTest = (new RegExp( '\\b' + exclusions.join('\\b|\\b') + '\\b') );

	var parseAppId = program.appId;
	var parseJSKey = program.jsKey;

	// Connect to Parse
	Parse.initialize(parseAppId, parseJSKey);

	if(verbose){
		console.log("Generating Roles");
	}

	parser.addRolesFromFile(dir + "/_Role.json").then(function(){
		if(verbose){
			console.log("Processing files " + files);
		}

		var creators = []
		_.each(files, function(exportFile){
			if(exclusionTest.test(exportFile)) {
				if(verbose){
					console.log("ignoring " + exportFile);
				}
			}
			else {
				if(verbose){
					console.log("processing " + exportFile);
				}
				creators.push(parser.addClassFromFile(dir + '/' +exportFile));
			}
		});

		if(verbose){
			console.log("Saving unlinked objects");
		}

		return Parse.Promise.when(creators);

	}).then(function(){

		return parser.saveToParse();

	}).then(function(){
		if(verbose){
			console.log("Generating links");
		}

		parser.generateLinks();

		if(parser.isComplete()){
			if(verbose){
				console.log("Save linked objects");
			}
			return parser.saveToParse();
		}
		else {
			console.log("\n\n********************\nParser has not seen all required classes");
			_.each(parser.missingClasses(), function(reference){
				console.log(JSON.stringify(reference));
			});

			return Parse.Promise.error();
		}

	}).then(function(){
	if(verbose){
			console.log("Claning up")
		}

		return parser.removeTempObjects();

	}).then(function(){
		console.log("Done");

	},
	function(error){

		console.log("Failed. Sorry about that. Probably best to start again with a new Parse app.");
		console.log("error was: " + JSON.stringify(error));
	});
}
