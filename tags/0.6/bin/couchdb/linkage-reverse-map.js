function(doc) {
    if (doc.node_type && doc.meta && doc.linkage) {
        for (var link_type in doc.linkage) {
            var link_array = doc['linkage'][link_type];
            for (var linkIdx = 0; linkIdx < link_array.length; linkIdx++) {
                var destId = link_array[linkIdx];
                emit(destId, doc._id);
            }
        }
    }
}
