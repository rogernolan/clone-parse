clone-parse
===========

clone-parse is a small node commandline script to take a Parse backup and 
create an identical copy of the schema and Roles (but no other data) in another Parse application.


Installation
------------
[Install node](http://nodejs.org/download/). Clone this repo and run `npm install`
    
Usage
-----
    node parser [options]
    
    Options:

       -h, --help              output usage information
       -V, --version           output the version number
       -v, --verbose           Verbose output
       -d, --directory <path>  Path to search for files [.]
       -j, --js-key <key>      Parse Javasccript key [SZ4Am...]
       -a, --app-id <key>      Parse app id [SZ4Am...]

Javascript Key and App id are required. Directory defaults to .

the importer should only be run on a clean database. If you try to run it twice, you'll probably fail because or trying to recrate the same Roles twice. It's *always* better to kill a failed Parse app and create a new one.

TODO
====

- no testcode because I couldn't find a good shell script test suite that would work with Parse
- Parse relations are not currently handled (only pointers and arrays)
- Installations, ERROR and other internal tables are not handled.
- All files are read from the directory, maybe nice to limit to a subset
- error handling/reporting is not great.



