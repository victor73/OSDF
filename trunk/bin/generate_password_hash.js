#!/usr/bin/env node

var commander = require('commander');
var pw_hash = require('password-hash');
var read = require('read');

commander.option('-u, --username <username>',
                 'Specify the username to make a password for.')
         .parse(process.argv);

if (! commander.username) {
    console.error("-u or --username is required ")
    process.exit(1)
}

var username = commander.username;


read({ prompt: 'Enter the password (not echoed): ', silent: true }, function(err, password) {
    if (err) {
        console.log("An error occurred: " + err);
    } else {
        confirm(password);
    }
});

function confirm(password) {
    read({ prompt: 'Confirm your password (not echoed): ', silent: true }, function(err, password2) {
        if (err) {
            console.log("An error occurred: " + err);
        } else {
            if (password === password2) {
                var hashedPassword = pw_hash.generate(password);

                if (pw_hash.verify(password, hashedPassword)) {
                    console.log(username + ":" + hashedPassword);
                }
            } else {
                console.error("*** ERROR: Passwords do not match. ***");
                process.exit(2);
            }
        }
    });
}
