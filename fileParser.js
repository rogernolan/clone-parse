'use strict';

var _ = require('underscore/underscore.js');
var fs = require('fs');
var jf = require('jsonfile');
var Parse = require('parse').Parse;

var createUser = function(){};		// TODO we should implement and use this as a function. It's currently hardcoded in createParseObject
var specialConstructor = {'_User.json' : createUser}
var specialTreatment = Object.keys(specialConstructor);


var parser = (function(){

	// Columns we don't parse for any object - mainly Parse internal.
	var excludedColums = ["ACL", "createdAt", "objectId", "updatedAt", "bcryptPassword", "sessionToken", "email"];

	var directory = '.';				// Where we grab files from
	var knownClasses = {};			// Parse objects keyed by classname
	var verbose = false;
	var missingPointers = [];		// Links to classes we have not seen yet. keyed by source, values is classname;
	var missingArrays = [];			// Links to classes we have not seen yet. keyed by source, values is classname;

	var defaultRole;					// a random role saved from addRolesFromParseExportFile used to create PFUsers
	function createParseObject(className) {

		if(className === '_User') {
			// Avoid UserCanOnlyBeCreatedThroughSignUpError
			return Parse.User.signUp("username", "password", {"email" : "test@test.com"});
		}

		var newObject = new Parse.Object(className)
		return Parse.Promise.as(newObject)
		// ToDO should really parse the specialConstructors hash.



	}

	// Generate a dummy parse array or link (or real geopoint
	function generateReference(jsonReference, currentClass, key){
		var reference;
		var isArray = false;
		if(jsonReference instanceof Array) {
			reference = jsonReference[0];
			isArray = true;
		}
		else {
			reference = jsonReference;
		}
		var type = reference['__type'];

		switch(type){
			case 'GeoPoint':
				var gp = new Parse.GeoPoint(10.0, 10.0);
				return gp;
				break;
			case 'Pointer':
				var className = reference['className'];

				// Store pointers and arrays seperately so we can fix them up correctly after we have all the classes.
				if(isArray){
					missingArrays.push({'from':currentClass, 'to':className, 'key':key});
				}
				else {
					missingPointers.push({'from':currentClass, 'to':className, 'key':key});
				}
				return;
			default:
				console.log("Unknown type in reference " + currentClass + " : " + type)

		}
	}

	// Takes a filename and loads up all
	// of the Roles in that file.
	function addRolesFromParseExportFile(fileName){
		var data = jf.readFileSync(fileName)
		var rows = data['results'];

		// By specifying no write privileges for the ACL, we can ensure the role cannot be altered.
		// TODO: we should read the ACL for the parse Role and use that.
		var roleACL = new Parse.ACL();
		roleACL.setPublicReadAccess(true);
		if(verbose){
			console.log("Will create " + rows.length + " Roles");
		}
		var parseRoles = [];
		_.each(rows, function(roleObject){
			if(verbose){
				console.log("Creating role: " + roleObject["name"])
			}
			var role = new Parse.Role(roleObject["name"], roleACL);
			parseRoles.push(role);
		});

		defaultRole = parseRoles[0];
		return Parse.Object.saveAll(parseRoles);
	}

	// Takes a filename returns a Parse object.
	// also adds to the list of missing references.
	function addClassFromParseExportFile(filename, className) {

		var data = jf.readFileSync(filename)

		var rows = data['results'];
		var object = rows[0];
		// console.log("First object is " + JSON.stringify(object));

		if(typeof (object) === 'undefined') {
			return {};
		}

		var exclusionTest  = (new RegExp( '\\b' + excludedColums.join('\\b|\\b') + '\\b') );

		return createParseObject(className).then(function(newObject){
			knownClasses[className] = newObject;
			_.each(Object.keys(object), function(key){
				if(!exclusionTest.test(key)){
					var dummyValue;
					var realValue = object[key];
					var type = typeof(realValue);
					// console.log("type of " + key + " is " + type);
					switch(type){
						case 'string':
							dummyValue = "Delete this dummy row it was created from setup";
							break;
						case 'object':
							dummyValue = generateReference(realValue, className, key);
							break;
						case 'boolean':
							dummyValue = false;
							break;
						case 'number':
							dummyValue = 666;
							break;
						default:
							console.log("Unknown type in JSON document " + fileName + " : " + type + " (" + JSON.stringify(realValue) + ")" )
					}

					if(typeof (dummyValue) !== 'undefined') {
						// We can get an undefined value back from links
						// where the far end has not been parsed yet.
						newObject.set(key, dummyValue);
					}
				}
			});
		});
	}

	function generateLinks(){

		_.each(missingPointers, function(reference){
			var destinationClassName = reference['to'];
			var sourceClassName = reference['from'];
			var key = reference['key']
			if(verbose){
				console.log("Adding pointer from " + sourceClassName + " to " + destinationClassName + " called " + key);
			}

			var source = knownClasses[sourceClassName];
			var target = knownClasses[destinationClassName];
			source.set(key, target);

			missingPointers = _.without(missingPointers, reference);
		});

		_.each(missingArrays, function(reference){
			var destinationClassName = reference['to'];
			var sourceClassName = reference['from'];
			var key = reference['key'];
			if(verbose){
				console.log("Adding array of "+ destinationClassName + " to " + sourceClassName + " called " + key);
			}
			console.log("get source/dest")
			var source = knownClasses[sourceClassName];
			var target = knownClasses[destinationClassName];
			console.log("add...")

			source.add(key, target);

			console.log("remove from missing array...")

			missingArrays = _.without(missingArrays, reference);
		});
	}

	// return an object
	return {
		addRolesFromFile: function (fileName){

			if(verbose)
				console.log("parsing roles from " + fileName);

			return addRolesFromParseExportFile(directory + '/' + fileName);
		},

		addClassFromFile: function (fileName, className){
			if(typeof (className) === 'undefined') {
				// extract the last string follwing a / and remove the .
				className = fileName.split('.').slice(-2)[0].split('/').slice(-1)[0]
			}

			if(className === '_User' && typeof(defaultRole) === 'undefined'){
				console.log("Must create Roles before Users");
				return Parse.Promise.error("No Roles");
			}
			if(verbose)
			console.log("parsing " + className + " from " + fileName);

			return addClassFromParseExportFile(directory + '/' + fileName, className);
		},

		generateLinks: function(){
			generateLinks();
		},

		setVerboseMode: function (shouldLog){
			verbose = shouldLog;
		},

		isComplete: function() {
			// TODO: could we check more here?
			return missingPointers.length === 0;
		},

		saveToParse: function(){
			var keys = Object.keys(knownClasses);
			var objects = keys.map(function(key) { return knownClasses[key]; });
			if(verbose){
				console.log("    Save " + objects.length + " temp objects to tables: "+ JSON.stringify(keys) );
			}
			return Parse.Object.saveAll(objects, {'wait': true,
				success: function(){
						console.log("********** saved **********");
					}});
		},

		removeTempObjects : function(){
			var keys = Object.keys(knownClasses);
			var objects = keys.map(function(key) { return knownClasses[key]; });
			if(verbose){
				console.log("    Deleting " + objects.length + " temp objects from tables: " + JSON.stringify(keys));
			}
			return Parse.Object.destroyAll(objects, {'wait': true,
					success: function(){
						console.log("******** deleted *********");
					}
				});

		},
		missingClasses: function(){
			return _.chain(missingPointers).pluck("to").uniq().value();
		}

	}

})();	// Trailing () causes the closure to execute. We export the return object.

exports.parser = parser;