// This is a truly simple javascript class to aid
// in the retrieval of values from the OSDF configuration
// file.

// The constructor.
//
// file - The path to the INI configuration file.
//
// Example: var c = new Config("/path/to/config.ini");

var instance = null;

Config = function (file) {
    var iniReader = require('./inireader');

    this.file = file;
    this.parser = new iniReader.IniReader();
    this.parser.load(file);

    instance = this;
}

// This method is used to retrieve data from the 
// configuration file.
//
// section - The INI section that the key is found under
// key - The name of the parameter to get the value for
//
// Example:  var server = c.value("database", "server");
Config.prototype.value = function(section, key) {
    return this.parser.param(section + '.' + key);
}

Config.prototype.reload = function() {
    this.parser.load(this.file);
}

Config.get_instance = function(file) {
    if (Config.instance == null) {
        Config.instance = new Config(file);
    }
 
    return Config.instance;
}
