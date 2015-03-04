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
