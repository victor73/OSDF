function(doc) {
    if (doc.node_type && doc.meta && doc.ns && doc.linkage) {

        var flattened_links = [];
        var seen = {};

        for (var link_type in doc.linkage) {
            var link_array = doc['linkage'][link_type];
            for (var linkIdx = 0; linkIdx < link_array.length; linkIdx++) {
                if (! (link_array[linkIdx] in seen) ) {
                    seen[link_array[linkIdx]] = 1;
                    flattened_links.push( link_array[linkIdx] );
                }
            }
        }

        for (var flatIdx = 0; flatIdx < flattened_links.length; flatIdx++) {
            emit( flattened_links[flatIdx], { _id: doc._id });
        }

    }
}
