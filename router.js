/**
 * Created by hcm on 23.09.2018.
 */
const {parse} = require('url');

class Router {
    constructor() {
        this.routes = [];
    }

    add(method, url, handler) {
        this.routes.push({method, url, handler});
    }

    resolve(context, request) {
        let path = parse(request.url).pathname;

        for (let {method, url, handler} of this.routes) {
            let match = url.exec(path);
            if (!match || request.method != method) continue;
            let urlParts = match.slice(1).map(decodeURIComponent);
            return handler(context, ...urlParts, request);
        }
    }
};

module.exports.Router = Router;
