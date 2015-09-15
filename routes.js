/*jshint sub:true, es5:true*/

var info_handler = require('info-handler');
var node_handler = require('node-handler');
var query_handler = require('query-handler');
var ns_handler = require('namespace-handler');
var schema_handler = require('schema-handler');

exports.set_routes = function (app) {
    // Node handler functions
    app.get('/nodes/:id', node_handler.get_node);
    app.get('/nodes/:id/ver/:ver', node_handler.get_node_by_version);
    app.get('/nodes/:id/out', node_handler.get_out_linkage);
    app.get('/nodes/:id/in', node_handler.get_in_linkage);

    app.post('/nodes', node_handler.insert_node);
    app.post('/nodes/validate', node_handler.validate_node);

    app.put('/nodes/:id', node_handler.update_node);

    app.delete('/nodes/:id', node_handler.delete_node);

    // Query handler functions
    app.post('/nodes/query/:ns', query_handler.perform_query);
    app.post('/nodes/query/:ns/page/:page', query_handler.perform_query);
    app.post('/nodes/oql/:ns', query_handler.perform_oql);
    app.post('/nodes/oql/:ns/page/:page', query_handler.perform_oql);

    // Info handler functions
    app.get('/info', info_handler.info);

    // Namespace handler functions
    app.get('/namespaces', ns_handler.get_all_namespaces);
    app.get('/namespaces/:ns', ns_handler.get_namespace);

    // Schema handler functions
    app.get('/namespaces/:ns/schemas', schema_handler.get_all_schemas);
    app.get('/namespaces/:ns/schemas/aux', schema_handler.get_all_aux_schemas);
    app.get('/namespaces/:ns/schemas/:schema', schema_handler.get_schema);
    app.get('/namespaces/:ns/schemas/aux/:aux', schema_handler.get_aux_schema);
    app.post('/namespaces/:ns/schemas', schema_handler.insert_schema);
    app.post('/namespaces/:ns/schemas/aux', schema_handler.insert_aux_schema);

    app.put('/namespaces/:ns/schemas/:schema', schema_handler.update_schema);
    app.put('/namespaces/:ns/schemas/aux/:aux', schema_handler.update_aux_schema);

    app.delete('/namespaces/:ns/schemas/:schema', schema_handler.delete_schema);
    app.delete('/namespaces/:ns/schemas/aux/:aux', schema_handler.delete_aux_schema);
};
