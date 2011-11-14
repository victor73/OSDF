// When using express, it inserts an 'X-Powered-By:Express" header entry into
// every response.  Let's not reveal what technologies we're using for better
// security. This might also have a small benefit for performance/bandwidth.
exports.remove_powered_by = function remove_powered_by() {
    return function removed_powered_by(request, response, next) {
        response.removeHeader("X-Powered-By");
        next();
    };
};
