/**
 * Created by hcm on 23.09.2018.
 */
/*
 This project is skillsharing / event planning website. Client-server communication is done through http requests.
 However, I will use long polling for instantaneous updates and not websockets.
 */

const {createServer} = require("http");
const Router = require("./router");
const ecstatic = require("ecstatic");

const router = new Router();
const defaultHeaders = {"Content-Type": "text/plain"};

class SkillShareServer {
    constructor(talks) {
        this.talks = talks;
        this.version = 0;
        this.waiting = [];

        let fileServer = ecstatic({root: "./public"});
        this.server = createServer((request, response) => {
           let resolved = router.resolve(this, request);
           if (resolved) {
               resolved.catch(error => {
                   if (error.status != null) return error;
                   return {body: String(error), status: 500};
               }).then(({body,
                        status = 200,
                        headers = defaultHeaders}) => {
                  response.writeHead(status, headers);
                  response.end(body);
               });
           } else {
               fileServer(request, response);
           }
        });
    }
    start(port) {
        this.server.listen(port);
    }
    stop() {
        this.server.close();
    }
}
/*
This uses a similar convention as the file server from the previous chapter for responses—handlers return promises that resolve to objects describing the response. It wraps the server in an object that also holds its state.
 */
