/* vim: set et ts=4 sts=4 sw=4 tw=92:
 * Copyright (C) 2021       presuku <presuku@gmail.com>
 * Copyright (C) 2017-2018  Jonathan Lebon <jonathan@jlebon.com>
 * This file is part of Textern for thunderbird.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";

var port = undefined;
var activeDocs = [];
var currentWinId = undefined;
var newLine = "\n"
var splitLine = "-=-=-=-=-=-=-=-=-=# DontRemoveThisLine #=-=-=-=-=-=-=-=-=-" + newLine;
var headers = {
    editheaders_subject    : {k:"subject",    v:"Subject",     s:false},
    editheaders_to         : {k:"to",         v:"To",          s:false},
    editheaders_cc         : {k:"cc",         v:"Cc",          s:false},
    editheaders_bcc        : {k:"bcc",        v:"Bcc",         s:false},
    editheaders_replyto    : {k:"replyTo",    v:"Reply-To",    s:false},
    editheaders_newsgroups : {k:"newsgroups", v:"Newsgroup",   s:false},
    editheaders_followupto : {k:"followupTo", v:"Followup-To", s:false},
};

function logError(error) {
    console.log(`Error: ${error}`);
}

function assertNoResponse(response) {
    console.assert(response == undefined);
}

function notifyError(error) {
    browser.notifications.create({
        type: "basic",
        title: "Textern.tb",
        message: "Error: " + error + "."
    });
}

async function getSettings() {

    var hs = headers;
    var rs = await browser.storage.local.get([
            "editheaders",
            "editheaders_subject",
            "editheaders_to",
            "editheaders_cc",
            "editheaders_bcc",
            "editheaders_replyto",
            "editheaders_newsgroups",
            "editheaders_followupto",
            ]).catch(logError);

    var editheaders = rs.editheaders;
    delete rs.editheaders

    if (editheaders) {
        for (let i in rs) {
            hs[i].s = rs[i];
        }
    } else {
        for (let i in rs) {
            hs[i].s = false;
        }
    }

    return [editheaders, hs];
}

async function setupRegisterDoc(msg) {
    const tid = msg.tid;
    const markHTML = msg.mark_html;
    const markText = msg.mark_text;
    let caret = msg.caret_offset;

    // Get the existing message.
    const details = await browser.compose.getComposeDetails(tid);
    const [editHeaders, hs] = await getSettings();
    let content = "";

    if (editHeaders) {
        for (let i in hs) {
            if (hs[i].s) {
                content += hs[i].v + ":"
                    + " ".repeat(11 - hs[i].v.length)
                    + details[hs[i].k] + newLine;
            }
        }
        content += splitLine
        caret += content.length;
    }

    let subject;
    if (details.subject == "") {
        subject = "untitled";
    } else {
        subject = details.subject;
    }

    const parser = new DOMParser()
    const html = parser.parseFromString(details.body, "text/html")
    let body;
    let p;
    if (details.isPlainText) {
        html.body.innerHTML = html.body.innerHTML
                                       .replace(markHTML, markText)
                                       .replace(/<br>/g, "<br>\n");
        body = html.body.innerText.split(markText)
        p = 1;
    } else {
        // remove first line feed after body tag.
        const innerHTML = ((s) => {
            if (s[0] == "\n") {
                return s.substring(1);
            } else {
                return s;
            }
        })(html.body.innerHTML);
        body = innerHTML.split(markHTML);
        p = 0;
    }

    caret += body[0].length;
    content += body[0] + body[1];

    await browser.tabs.sendMessage(tid, {
        type: "restore_html",
        tid: tid,
    }).then(assertNoResponse, logError);

    registerDoc(tid, p, content, caret, subject);
}

async function contentSetActiveText(tid, isPlain, text) {
    var contentList = text.split(splitLine);
    var body;
    var [editHeaders, hs] = await getSettings();

    if (editHeaders && contentList.length == 1) {
        notifyError("malformed error");
        return;
    } else if (!editHeaders && contentList.length == 1) {
        body = contentList[0];
    } else {
        body = contentList[1];
    }
    var headerList = contentList[0].split(newLine)
    var hTable = new Array;
    var headerType = "unknown"; // should never be used

    for (var i = 0; i < headerList.length; ++i) {
        var whichHeader = headerList[i].split(":");
        if (whichHeader.length >= 2) {
            headerType = ((h, s) => {
                            for (let i in h) {
                                if (h[i].v.toLowerCase() == s) { return h[i].k; }
                            }
                         })(hs, whichHeader.shift().replace(/\s+/g, "").toLowerCase());
            // if the subject contains ":", the array has more than 2 members...
            var headerContent = whichHeader.join(":").replace(/^\s+/, "");
            if (hTable[headerType] === undefined) {
                hTable[headerType] = headerContent;
            } else {
                hTable[headerType] += "," + headerContent;
            }
        } else {
            // if not only spaces or empty line
            if (/\w/.test(headerList[i])) {
                hTable[headerType] += "," + headerList[i];
            }
        }
    }

    for (let i in hs) {
        if (hTable[hs[i].k] === undefined) {
            hTable[hs[i].k] = ""
        }
    }


    var payload = (() => {
        var p = {};
        for (let i in hs) {
            p[hs[i].k] = hs[i].s ? hTable[hs[i].k] : undefined;
        }
        p.plainTextBody = undefined;
        p.body          = undefined;
        return p;
    })();

    browser.compose.setComposeDetails(tid, payload);
    await browser.tabs.sendMessage(tid, {
        type: "set_text",
        plain: isPlain,
        text: body
    }).then(assertNoResponse, logError);
}


function handleNativeMessage(msg) {
    if (msg.type == "text_update") {
        var [tid, isPlain] = msg.payload.id.split("_").map(x => { return parseInt(x); });
        if (tid == NaN || isPlain == NaN) {
            console.log(`Invalid id: ${msg.payload.id}`);
            return;
        }
        contentSetActiveText(tid, isPlain, msg.payload.text);
    } else if (msg.type == "death_notice") {
        unregisterDoc(msg.payload.id);
    } else if (msg.type == "error") {
        notifyError(msg.payload.error);
    } else {
        console.log(`Unknown native message type: ${msg.type}`);
    }
}

function unregisterDoc(id) {

    var i = activeDocs.indexOf(id);
    if (i == -1) {
        console.log(`Error: document id ${id} isn't being edited`);
        return;
    }

    activeDocs.splice(i, 1);
    if (activeDocs.length == 0) {
        port.disconnect();
        port = undefined;
    }
}

async function registerDoc(tid, isPlain, text, caret, subject) {

    var id = `${tid}_${isPlain}`;
    if (activeDocs.indexOf(id) != -1) {
        console.log(`Error: document id ${id} is already being edited`);
        notifyError("this text is already being edited");
        return;
    }

    activeDocs.push(id);
    if (port == undefined) {
        port = browser.runtime.connectNative("textern.tb");
        if (port.error) {
            unregisterDoc(id);
            notifyError("connect to native application failed");
            logError(p.error);
            return;
        }
        port.onMessage.addListener((response) => {
            handleNativeMessage(response);
        });
        port.onDisconnect.addListener((p) => {
            console.log("Disconnected from helper");
            activeDocs = [];
            port = undefined;
        });
    }

    var values = await browser.storage.local.get({
                    editor: "[\"gedit\", \"+%l:%c\"]",
                    extension: "eml"
                }).catch(logError);
    port.postMessage({
        type: "new_text",
        payload: {
            id: id,
            text: text,
            caret: caret,
            subject: subject,
            editor: values.editor,
            extension: values.extension
        }
    });
}

function onFocusChanged(windowId) {
    currentWinId = windowId;
}

async function onCommand(command) {
    if (command === "textern.tb-trigger-feature") {
        let tabs = await browser.tabs.query({
            windowId: currentWinId,
            lastFocusedWindow: false,
            windowType: "messageCompose",
            active: true
        }).catch(logError);

        await browser.tabs.sendMessage(tabs[0].id, {
            type: "set_mark",
            tid: tabs[0].id,
        }).then(assertNoResponse, logError);
    }
}

async function onClicked(tab) {
    await browser.tabs.sendMessage(tab.id, {
        type: "set_mark",
        tid: tab.id,
    }).then(assertNoResponse, logError);
}

async function onChanged(change) {
  browser.commands.update({
    name: "textern.tb-trigger-feature",
    shortcut:change.shortcut.newValue
  });
}

function onMessage(message, sender, respond) {
    if (sender.id != "textern.tb@example.com")
        return;
    if (message.type == "do_setup") {
        setupRegisterDoc(message);
    } else {
        console.log(`Unknown message type: ${message.type}`);
    }
}

(async () => {
    browser.windows.onFocusChanged.addListener(onFocusChanged);
    browser.commands.onCommand.addListener(onCommand);
    browser.composeAction.onClicked.addListener(onClicked);
    browser.storage.onChanged.addListener(onChanged);
    browser.runtime.onMessage.addListener(onMessage);
    browser.composeScripts.register({ js: [ {file: "content.js"}, ] });
    window.addEventListener('unload', () => {
        browser.windows.onFocusChanged.removeListener(onFocusChanged);
        browser.commands.onCommand.removeListener(onCommand);
        browser.composeAction.onClicked.removeListener(onClicked);
        browser.storage.onChanged.removeListener(onChanged);
        browser.runtime.onMessage.removeListener(onMessage);
    });
})();

