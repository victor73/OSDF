var fs = require('fs');
var utils = require('osdf_utils');
require('config');

var c = Config.get_instance(utils.get_config());
var bind_address = c.value("global", "bind_address");
var port = c.value("global", "port");
var base_url = c.value("global", "base_url");
var root_local_dir = utils.get_osdf_root();

exports.get_all_schemas = function (request, response) {
    console.log("In get_all_schemas.");

    var path = root_local_dir + '/namespaces/' + request.params.ns + '/schemas';

    // TODO: Do not use the synchrnous version...
    var files = fs.readdirSync(path);
    var files_array = [];
    for(var x in files) {
        try {
            var file_text = fs.readFileSync(path+'/'+files[x],'utf8');
            var file_obj = JSON.parse(file_text);
            files_array.push(file_obj);
        } catch (e) {
            console.log(e);
        }
    }
    var json = {};
    json.result_count = x + 1;
    json.page = 1;
    json.results = files_array;

    response.json(json);
}

exports.get_schema = function (request, response) {
    var path = root_local_dir+'/namespaces/' + request.params.ns + '/schemas/' + request.params.schema;
    fs.readFile(path, 'utf8', function (err, data) {
        if (err) {
            response.send('', {'X-OSDF-Error': "Schemas not found"}, 404);
            return false;
        }
        response.json(JSON.parse(data))
    });
}

exports.post_schema = function (request, response) {
    var schema = JSON.parse(request.rawBody);
    var ident = schema.id;

    if (ident && schema.properties && schema.properties.meta)  {
	    var path = root_local_dir + '/namespaces/' + request.params.ns+'/schemas';
	    schema.id=ident;

            //check if dir exists, otherwise create it
	    try {fs.readdirSync(path);} catch(err) {fs.mkdirSync(path,0777);}
	    fs.writeFile(path+'/'+schema.id, JSON.stringify(schema), function (err) {
	    	  if (err) {
                      console.log(err);
	              response.send('', {'X-OSDF-Error': 'Error creating schema'}, 422);
	    	  }
	    	  response.writeHead(201, {'Location': base_url + ':' + port + '/namespaces/' + request.params.ns+'/schemas/'+schema.id});
		      response.write('{"success":"true","id":"'+schema.id+'"}');
		      response.end();
	    	});
    } else {
    	response.send('', {'X-OSDF-Error': "Invalid JSON"}, 422);
    }
}

exports.delete_schema = function (request, response) {
    var path = root_local_dir + '/namespaces/' + request.params.ns+'/schemas/' + request.params.schema;

    fs.unlink(path, function (err, data) {
        if (err) {
            console.log(err);
            response.send('', {'X-OSDF-Error': "Problem deleting schema"}, 500);
        } else {
          response.send('', 204);
        }
    });
}
