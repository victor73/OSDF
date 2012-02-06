var path = require('path');
var config = require('config');
var utils = require('osdf_utils');
var logger = utils.get_logger();
var info = {};

exports.init = function(emitter) {
    logger.debug("In " + path.basename(__filename) + " init().");

    exports.update();

    emitter.emit("info_handler_initialized");
}

exports.info = function(request, response) {
    logger.debug("In info.");
    response.json(info);
}

exports.update = function() {
    logger.debug("In update.");

    var c = Config.get_instance();
    c.reload();

    info['api_version'] = c.value("info", "api_version");
    info['title'] = c.value("info", "title");
    info['description'] = c.value("info", "description");
    info['admin_contact_email1'] = c.value("info", "admin_contact_email1");
    info['admin_contact_email2'] = c.value("info", "admin_contact_email2");
    info['technical_contact1'] = c.value("info", "technical_contact1");
    info['technical_contact2'] = c.value("info", "technical_contact2");
    info['comment1'] = c.value("info", "comment1");
    info['comment2'] = c.value("info", "comment2");
}
