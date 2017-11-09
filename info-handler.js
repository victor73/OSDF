var path = require('path');
var config = require('config');
var utils = require('osdf_utils');
var logger = utils.get_logger();
var info = {};

exports.init = function(emitter) {
    logger.debug('In ' + path.basename(__filename) + ' init().');

    exports.update();

    emitter.emit('info_handler_initialized');
};

exports.info = function(request, response) {
    logger.debug('In info.');
    response.jsonp(info);
};

exports.update = function() {
    logger.debug('In update.');

    config.reload();

    info['api_version'] = config.value('info', 'api_version');
    info['title'] = config.value('info', 'title');
    info['description'] = config.value('info', 'description');
    info['admin_contact_email1'] = config.value('info', 'admin_contact_email1');
    info['admin_contact_email2'] = config.value('info', 'admin_contact_email2');
    info['technical_contact1'] = config.value('info', 'technical_contact1');
    info['technical_contact2'] = config.value('info', 'technical_contact2');
    info['comment1'] = config.value('info', 'comment1');
    info['comment2'] = config.value('info', 'comment2');
};
