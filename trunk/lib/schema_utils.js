// This function parses a JSON structure and looks for keys named '$ref'
// The function returns an array of the '$ref' values.
exports.extractRefNames = function (struct) {
    var refs = [];
    var keyName;
    var deeperIdx;

    // Check that we have a dictionary
    if (typeof struct === "object") {
        for (keyName in struct) {
            if (typeof struct[keyName] === "object") {
                var deeper_refs = exports.extractRefNames(struct[keyName]);
                if (deeper_refs !== null && deeper_refs.length > 0) {
                    for (deeperIdx = 0; deeperIdx < deeper_refs.length ; deeperIdx++) {
                        refs.push(deeper_refs[deeperIdx]);
                    }
                }
            } else if (keyName === "$ref") {
                if (struct[keyName].length > 0) {
                    refs.push(struct[keyName]);
                }
            }
        }
    }
    return refs;
};
