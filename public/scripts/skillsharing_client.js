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
        fetchOK(talkURL(action.talk) + "/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                author: state.user,
                message: action.message
            })
        }).catch(reportError);
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
    alert(String(error));
}

function renderUserField(name, dispatch) {
    return elt("label", {}, "Your name: ", elt("input", {
        type: "text",
        value: name,
        onchange(event) {
            dispatch({type: "setUser", user: event.target.value});
        }
    }));
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

function renderTalk(talk, dispatch) {
    return elt(
        "section", {className: "talk"},
        elt("h2", null, talk.title, " ", elt("button", {
            type: "button",
            onclick() {
                dispatch({type: "deleteTalk", talk: talk.title});
            }
        }, "Delete")),
        elt("div", null, "by ",
            elt("strong", null, talk.presenter)),
        elt("p", null, talk.summary),
        ...talk.comments.map(renderComment),
        elt("form", {
                onsubmit(event) {
                    event.preventDefault();
                    let form = event.target;
                    dispatch({type: "newComment",
                        talk: talk.title,
                        message: form.elements.comment.value});
                    form.reset();
                }
            }, elt("input", {type: "text", name: "comment"}), " ",
            elt("button", {type: "submit"}, "Add comment")));
}


