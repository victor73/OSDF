var cradle = require('cradle');
var utils = require('utils');
var http = require('http');
var fs = require('fs');

require('config');
var c = Config.get_instance(utils.get_config());

// config globals
var base_url = c.value("global", "base_url");
var port = c.value('global', 'port');
var couch_ip = c.value('global', 'couch_ip');
var couch_port = c.value('global', 'couch_port');;
var couch_user = c.value('global', 'couch_user');
var couch_pass = c.value('global', 'couch_pass');
var dbname = c.value('global', 'dbname');
var perpage = c.value('global', 'perpage');

// Cross function dynamic globals
var stay_alive = false;
var search_results_summary_global = {};
var search_results_global = {};

exports.post_query = function (req,res) {
    var content = req.rawBody;
    var obj = JSON.parse(map_data(content,'to_couch'));
    var query_text = generate_query(obj,[],'');
    query_text = encodeURI(query_text.join(' AND '));
    stay_alive = 1;
    build_couch_request('GET','/'+dbname+'/_fti/_design/query/all_fields?q='+query_text+'&limit=99999',res,'',store_results);
}

// Generates Lucene query search based on json obj passed in
// via POST
function generate_query(obj,query,parent) {
    for(var key in obj) {
            if (!isNaN(key)) { // if it is not a numeric array
                    var fieldname=parent;
            } else if (parent) {
                    var fieldname=parent+'_'+key; 
            }  else {var fieldname=key;}
            
            switch (typeof obj[key]) 
            { 
                  case 'object':
                          //traverse the entire json structure
                          query = generate_query(obj[key],query, fieldname);
                          break;
                  default: 
                          query.push(fieldname+':'+obj[key]);
                          break;
            }  
    }
    return query;
}

function store_results(responseBody,res,request) {
    var results = JSON.parse(responseBody);
    var path = utils.get_osdf_root() + '/query/';
    try {fs.readdirSync(path);} catch(err) {fs.mkdirSync(path,0777);} //check if dir exists, otherwise create it
    fs.writeFile(path+'/'+results.etag, responseBody, function (err) {
  	  if (err) {
  		  res.writeHead(422,'error writing file: '+ err);
  		  throw err;
  		  res.end();
  	  }
  	  res.writeHead(201, results.etag);
  	  res.write(results.etag);
	  res.end();
    });  
}

exports.getQueryResults = function (req,res) {
    var file_text = fs.readFileSync(root_local_dir+'/query/'+req.params.token,'utf8');
    search_results_summary_global = JSON.parse(file_text);
    search_results_global.page = req.params.page ? req.params.page : 1;
    search_results_global.total_results = search_results_summary_global.total_rows;
    search_results_global.total_pages = Math.ceil(search_results_global.total_results / perpage);
    search_results_global.start = (search_results_global.page - 1) * perpage;
    var abs_end = search_results_global.start + perpage - 1;
    search_results_global.end = abs_end < search_results_global.total_results ? abs_end : search_results_global.total_results - 1;
    search_results_global.results = [];
    search_results_global.token = req.params.token;
    generate_results(res);
}

//generates pagination query results for calls that return multiple nodes
function generate_results(res) {
	  var results = search_results_summary_global.rows;
	  for (var x = search_results_global.start; x <= search_results_global.end; x++)
	  {
		  stay_alive = true;
		  build_couch_request('GET','/'+dbname+'/'+results[x].id,res,'',add_to_results,stay_alive);
	  }
}

function add_to_results(responseBody,res,request) {
    var node = JSON.parse(map_data(responseBody,'to_osdf'));
    search_results_global.results.push(node);
    last_node = search_results_summary_global.rows[search_results_global.end];
    if (node.id) {
            if (last_node.id == node.id) {
                    if (search_results_global.page < search_results_global.total_pages)
                    {
                            res.writeHead(206,base_url + ':' + port + '/nodes/query/'+ search_results_global.token + '/page/' + search_results_global.page - -1);
                    }
                    res.write(JSON.stringify(search_results_global));
                    res.end();
            }
    } else {
            res.writeHead(204, 'No content');
            res.end();
            stay_alive = false;
    }
}

function build_couch_request(method, url, res, data, callback) {
    var auth = 'Basic ' + new Buffer(couch_user + ':' + couch_pass).toString('base64');
    var client = http.createClient(couch_port, couch_ip);
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': auth
    };

    var couch_request = client.request(method, url, headers);
    if (data) {
        // console.log(data);
        data = map_data(data,'to_couch');
        couch_request.write(data);
    }
    couch_request.end();

    var responseBody = "";
    couch_request.on('response', function(response) {
        response.on("data", function(chunk) {
            responseBody += chunk;
        });

        response.on("end", function() {
            if (callback) {
                callback(responseBody, response, res);
            } else {
                //console.log(responseBody);
                var output = map_data(responseBody,'to_osdf');
                res.writeHead(response.statusCode, {'Content-Type': 'text/plain'});
                res.write(output);
                res.end();
            }
        });
    });
}

// function to map data from a couch document to an osdf node
// the main changes at this point are "_id" is "id" and "_rev" is "ver"
function map_data(data,dest) {
    //data = map_data(data);
    var new_data = typeof data == 'object' ? data : JSON.parse(data);
    var map_list = [];
    map_list['_id'] = 'id';
    map_list['_rev'] = 'ver';
    map_list['rev'] = 'ver';
    for (key in map_list) {
        if (dest == 'to_osdf') {
            if (new_data[key]) {
                new_data[map_list[key]]=new_data[key];
                delete new_data[key];
            }
        } else {
                if (new_data[map_list[key]]) {
                        new_data[key]=new_data[map_list[key]];
                        delete new_data[map_list[key]];
                }
        }
    }
    return JSON.stringify(new_data);
}
