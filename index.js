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
const fs = require("fs");

const router = new Router();
const defaultHeaders = {"Content-Type": "text/plain"};

module.exports.init = function () {
    let port = process.env.PORT || 8000;
    let sss = new SkillShareServer(Object.create(null));
    sss.start(port);
};

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
                }).then(({
                             body,
                             status = 200,
                             headers = defaultHeaders
                         }) => {
                    response.writeHead(status, headers);
                    response.end(body);
                });
            } else {
                fileServer(request, response);
            }
        });
    }

    async saveToDisk(callback) {
        fs.writeFile("./talks/talks.json", JSON.stringify(this.talks), callback);
    };

    async loadFromDisk(callback) {
        return fs.readFile("./talks/talks.json", callback);
    };

    stop() {
        this.server.close();
    }
}

SkillShareServer.prototype.start = function (port) {
    this.server.listen(port);
    let setTalks = ((callback) => {
        this.talks = this.loadFromDisk(function (err, data) {
            if (err) {
                if (err.code == "ENOENT") {
                    console.log("No talks file found");
                    return Object.create(null);
                } else {
                    throw(err);
                }
            }
            return JSON.parse(data);
        });
        callback();
    });
    setTalks(this.updated())

};

SkillShareServer.prototype.talkResponse = function () {
    let talks = [];
    for (let title of Object.keys(this.talks)) {
        talks.push(this.talks[title]);
    }
    return {
        body: JSON.stringify(talks),
        headers: {
            "Content-Type": "application/json",
            "ETag": `"${this.version}"`
        }
    };
};

SkillShareServer.prototype.waitForChanges = function (time) {
    return new Promise(resolve => {
        this.waiting.push(resolve);
        setTimeout(() => {
            if (!this.waiting.includes(resolve)) return;
            this.waiting = this.waiting.filter(r => r != resolve);
            resolve({status: 304});
        }, time * 1000);
    });
};

SkillShareServer.prototype.updated = function () {
    this.version++;
    let response = this.talkResponse();
    this.waiting.forEach(resolve => resolve(response));
    this.waiting = [];
    this.saveToDisk((err) => {
        if (err) throw err;
        console.log("Talks file has been saved!");
    });
};

/*
This uses a similar convention as the file server from the previous chapter for responses—handlers return promises that resolve to objects describing the response. It wraps the server in an object that also holds its state.
 */

const talkPath = /^\/talks\/([^\/]+)$/;
router.add("GET", talkPath, async (server, title) => {
    if (title in server.talks) {
        return {
            body: JSON.stringify(server.talks[title]),
            headers: {"Content-Type": "application/json"}
        };
    } else {
        return {status: 404, body: `No talk '${title}' found`};
    }
});

router.add("DELETE", talkPath, async (server, title) => {
    if (title in server.talks) {
        delete server.talks[title];
        server.updated();
    }
    return {status: 204};
});

/*
The updated method, which we will define later, notifies waiting long polling requests about the change.
 */

function readStream(stream) {
    return new Promise((resolve, reject) => {
        let data = "";
        stream.on("error", reject);
        stream.on("data", chunk => data += chunk.toString());
        stream.on("end", () => resolve(data));
    });
}

router.add("PUT", talkPath,
    async (server, title, request) => {
        let requestBody = await readStream(request);
        let talk;
        try {
            talk = JSON.parse(requestBody);
        }
        catch (_) {
            return {status: 400, body: "Invalid JSON"};
        }

        if (!talk ||
            typeof talk.presenter != "string" ||
            typeof talk.summary != "string") {
            return {status: 400, body: "Bad talk data"};
        }
        server.talks[title] = {
            title,
            presenter: talk.presenter,
            summary: talk.summary,
            comments: []
        };
        server.updated();
        return {status: 204};
    });

/*
Adding a comment to a talk works similarly. We use readStream to get the content of the request, validate the resulting data, and store it as a comment when it looks valid.
 */

router.add("POST", /^\/talks\/([^\/]+)\/comments$/,
    async (server, title, request) => {
        let requestBody = await readStream(request);
        let comment;
        try {
            comment = JSON.parse(requestBody);
        }
        catch (_) {
            return {status: 400, body: "Invalid JSON"};
        }

        if (!comment ||
            typeof comment.author != "string" ||
            typeof comment.message != "string") {
            return {status: 400, body: "Bad comment data"};
        } else if (title in server.talks) {
            server.talks[title].comments.push(comment);
            server.updated();
            return {status: 204};
        } else {
            return {status: 404, body: `No talk '${title}' found`};
        }
    });

router.add("GET", /^\/talks$/, async (server, request) => {
    let tag = /"(.*)"/.exec(request.headers["if-none-match"]);
    let wait = /\bwait=(\d+)/.exec(request.headers["prefer"]);
    if (!tag || tag[1] != server.version) {
        return server.talkResponse();
    } else if (!wait) {
        return {status: 304};
    } else {
        return server.waitForChanges(Number(wait[1]));
    }
});
/*
If no tag was given or a tag was given that doesn’t match the server’s current version, the handler responds with the list of talks. If the request is conditional and the talks did not change, we consult the Prefer header to see whether we should delay the response or respond right away.
 */
