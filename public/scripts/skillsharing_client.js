class SkillShareApp {
    constructor(state, dispatch) {
        this.dispatch = dispatch;
        this.talkDOM = elt("div", {className: "talks"});
        this.dom = elt("div", null,
            renderUserField(state.user, dispatch),
            this.talkDOM,
            renderTalkForm(dispatch)
        );
        this.syncState(state);
    }

    syncState(state) {
        if (state.talks != this.talks) {
            this.talkDOM.textContent = "";
            for (let talk of state.talks) {
                if (this.talks) {
                    this.talkDOM.appendChild(
                        renderTalk(talk, this.dispatch, getActiveComment(this.talks, talk.title)));
                } else {
                    this.talkDOM.appendChild(
                        renderTalk(talk, this.dispatch, getActiveComment(state.talks, talk.title)));
                }
            }
            this.talks = state.talks;
        }
    }

    /* NOTE
        Given title of state.talks talk, returns talkDOM comment field
     */
    getCommentInput(title) {
        if (this.talkDOM == {}) return "";
        for (let talkObject of this.talkDOM.childNodes) {
            console.log(`${title} == ${talkObject.querySelector("h2").innerText.trim()} is ${talkObject.querySelector("h2").innerText.trim() == title}`);
            if (talkObject.querySelector("h2").innerText.value == title) {
                console.log(`caught at: ${title}`);
                return talkObject.querySelector("input").innerText;
            }
        }
        return "";
    }
}

//When the talks change, this component redraws all of them. This is simple but also wasteful. We’ll get back to that in the exercises.


function getActiveComment(talks, title) {
    for (let talk of talks) {
        if (talk.title.trim() === title.trim()) {
            if (talk.activeComment) {
                return talk.activeComment;
            }
        }
    }
    return "";
}

function setActiveComment(state, title, comment) {
    for (let talk of state.talks) {
        if (talk.title.trim() === title.trim()) {
            talk.activeComment = comment;
            return;
        }
    }
    return -1;
}

//We can start the application like this:
function runApp() {
    let user = localStorage.getItem("userName") || "Anon";
    let state, app;

    function dispatch(action) {
        state = handleAction(state, action);
        app.syncState(state);
    }

    pollTalks(talks => {
        if (!app) {
            state = {user, talks};
            app = new SkillShareApp(state, dispatch);
            document.body.appendChild(app.dom);
        } else {
            dispatch({type: "setTalks", talks});
        }
    }).catch(reportError);
}

runApp();

///////////////////////////////////////


function handleAction(state, action) {
    if (action.type == "setUser") {
        localStorage.setItem("userName", action.user);
        return Object.assign({}, state, {user: action.user});
    } else if (action.type == "setTalks") {
        return Object.assign({}, state, {talks: action.talks});
    } else if (action.type == "newTalk") {
        fetchOK(talkURL(action.title), {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                presenter: state.user,
                summary: action.summary
            })
        }).catch(reportError);
    } else if (action.type == "deleteTalk") {
        fetchOK(talkURL(action.talk), {method: "DELETE"})
            .catch(reportError);
    } else if (action.type == "newComment") {
        let talk = action.talk;
        fetchOK(talkURL(action.talk) + "/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                author: state.user,
                message: action.message
            })
        }).catch(reportError);
        setActiveComment(state, talk, "");
    } else if (action.type == "commentFieldChange") {
        let talk = action.title;
        setActiveComment(state, talk, action.message);
    }
    return state;
}

function fetchOK(url, options) {
    return fetch(url, options).then(response => {
        if (response.status < 400) return response;
        else throw new Error(response.statusText);
    });
}

function talkURL(title) {
    return "talks/" + encodeURIComponent(title);
}

function reportError(error) {
    alert(String());
}

function renderUserField(name, dispatch) {
    return elt("section", {
        className: "name-field",
    }, elt("label", {}, "Your name: ", elt("input", {
        type: "text",
        value: name,
        onchange(event) {
            dispatch({type: "setUser", user: event.target.value});
        }
    })));
}

function elt(type, props, ...children) {
    //create the dom elt
    let dom = document.createElement(type);
    //assign properties
    if (props) Object.assign(dom, props);
    //append all the children
    for (let child of children) {
        if (typeof child != `string`) dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }
    //return the element
    return dom;
}

function renderTalk(talk, dispatch, typedComment) {
    return elt(
        "section", {className: "talk"},
        elt("section", {className: "talkHeader"}, elt("section", {className: "talkTitle"},
            elt("h2", null, talk.title, " "),
            elt("button", {
                type: "button",
                onclick() {
                    dispatch({type: "deleteTalk", talk: talk.title});
                }
            }, "Delete")),
            elt("div", null, "by ",
                elt("strong", null, talk.presenter))),
        elt("p", null, talk.summary),
        ...talk.comments.map(renderComment),
        elt("form", {
                onsubmit(event) {
                    event.preventDefault();
                    let form = event.target;
                    dispatch({
                        type: "newComment",
                        talk: talk.title,
                        message: form.elements.comment.value
                    });
                    form.reset();
                }
            }, elt("input", {
                type: "text", name: "comment", value: typedComment, onkeyup: ((event) => {
                    let form = event.target;
                    dispatch({
                        type: "commentFieldChange",
                        title: talk.title,
                        message: form.value
                    });
                })
            }, " "),
            elt("button", {type: "submit"}, "Add comment")));
}

function renderComment(comment) {
    return elt("p", {className: "comment"}, elt("strong", null, comment.author), ": ", comment.message);
}

function renderTalkForm(dispatch) {
    let title = elt("input", {type: "text"});
    let summary = elt("input", {type: "text"});
    return elt("form", {
            onsubmit(event) {
                event.preventDefault();
                dispatch({
                    type: "newTalk",
                    title: title.value,
                    summary: summary.value
                });
                event.target.reset();
            },
            className: "talk-form"
        }, elt("h3", null, "Submit a Talk"),
        elt("label", null, "Title: ", title),
        elt("label", null, "Summary: ", summary),
        elt("button", {type: "submit"}, "Submit"));
}

async function pollTalks(update) {
    let tag = undefined;
    for (; ;) {
        let response;
        try {
            response = await fetchOK("/talks", {
                headers: tag && {
                    "If-None-Match": tag,
                    "Prefer": "wait=90"
                }
            });
        } catch (e) {
            console.log("Request failed: " + e);
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
        }
        if (response.status === 304) continue;
        tag = response.headers.get("ETag");
        update(await response.json());
        if (response.status === 999) break;
    }
}




