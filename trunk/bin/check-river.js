#!/usr/bin/env node

var commander = require('commander');
var elasticsearch = require('elasticsearch');
var util = require('util');

commander.option('-s, --server <username>',
                 'Specify the elasticsearch server to check.')
         .parse(process.argv);

if (! commander.server) {
    console.error("-s or --server is required ")
    process.exit(1)
}


var es_river_name = "osdf";
var elasticsearch_host = commander.server;
var elasticsearch_port = 9200;

// handler is ready to begin its work are: establish a connection to the
// ElasticSearch server and determine if the OSDF river (listening for
// changes from CouchDB changes feed) is available.

var elastic_client = new elasticsearch.Client({ host: elasticsearch_host + ":" + elasticsearch_port });

//elastic_client.indices.exists({index: 'osdf' },
//                                   function (err, result) {

// Abort the server start-up if ElasticSearch or the index we need isn't there.
elastic_client.indices.existsType({index: 'osdf',
                                  type: 'osdf' },
                                  function (err, result) {
      if (err) {
          var err_msg = 'Unable to determine if ElasticSearch CouchDB river exists.';
          console.log(err_msg);
          console.log(err)
          process.exit(2)
      }

      if (result === true) {
          console.log('"ElasticSearch CouchDB river "' + es_river_name + "' exists.");
          process.exit(0);
      } else {
          console.log('"ElasticSearch CouchDB river "' + es_river_name + "' doesn't seem to exist.");
          process.exit(1);
      }
});
