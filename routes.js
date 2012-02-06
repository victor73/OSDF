var info_handler = require('info-handler');
var node_handler = require('node-handler');
var query_handler = require('query-handler');
var ns_handler = require('namespace-handler');
var schema_handler = require('schema-handler');

exports.set_routes = function (app) {
    // Node handler functions
    app.get('/nodes/:id', node_handler.get_node);
    app.get('/nodes/:id/ver/:ver', node_handler.get_node_by_version);
    app.post('/nodes', node_handler.insert_node);
    app.put('/nodes/:id', node_handler.update_node);
    app.delete('/nodes/:id', node_handler.delete_node);
    app.get('/nodes/:id/out', node_handler.get_out_linkage);
    app.get('/nodes/:id/in', node_handler.get_in_linkage);

    // Query handler functions
    app.get('/nodes/query', query_handler.perform_query);
    app.post('/nodes/query', query_handler.perform_query);
    app.get('/nodes/query/:token', query_handler.get_query_results);
    app.get('/nodes/query/:token/page/:page', query_handler.get_query_results);

    // Info handler functions
    app.get('/info', info_handler.info);

    app.get('/namespaces', ns_handler.get_all_namespaces);
    app.get('/namespaces/:ns', ns_handler.get_namespace);

    app.get('/namespaces/:ns/schemas', schema_handler.get_all_schemas);
    app.get('/namespaces/:ns/schemas/:schema', schema_handler.get_schema);
    app.post('/namespaces/:ns/schemas', schema_handler.post_schema);
    app.delete('/namespaces/:ns/schemas/:schema', schema_handler.delete_schema);
};
