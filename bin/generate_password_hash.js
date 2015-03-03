#!/usr/bin/env node

var commander = require('commander');
var pw_hash = require('password-hash');
var read = require('read');

commander.option('-u, --username <username>',
                 'Specify the username to make a password for.')
         .parse(process.argv);

var username = commander.username;


read({ prompt: 'Enter the password (not echoed): ', silent: true }, function(err, password) {
    if (err) {
        console.log("An error occurred: " + err);
    } else {
        var hashedPassword = pw_hash.generate(password);

        if (pw_hash.verify(password, hashedPassword)) {
            console.log(username + ":" + hashedPassword);
        }
    }
});

/*
var prompt = require('prompt');
var schema = {
    properties: {
        password: {
            message: "Please enter the password.",
            hidden: true,
            required: true
        }
    }
};

// Start the prompt
prompt.start();

// Get two properties from the user: email, password
prompt.get(schema, function (err, result) {
    var password = result.password;

    // Log the results.
    console.log('  password: ' + password);

});
*/
