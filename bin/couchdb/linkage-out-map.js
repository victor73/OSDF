function(doc) {
    if (doc.ns && doc.node_type && doc.meta && doc.linkage) {

        emit([doc._id, 0], null);

        if (doc.linkage) {

            var flattened_links = [];

            for (var link_type in doc.linkage) {
                var link_array = doc['linkage'][link_type];
                for (var linkIdx = 0; linkIdx < link_array.length; linkIdx++) {
                    flattened_links.push( link_array[linkIdx] ); 
                }
            }

            for (var flatIdx = 0; flatIdx < flattened_links.length; flatIdx++) {
                emit([doc._id, Number(flatIdx) + 1], {_id: flattened_links[flatIdx] });
            }
        }
    }
}
