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

// regiser compose script
(async () => {
    browser.windows.onFocusChanged.addListener(onFocusChanged);
    browser.commands.onCommand.addListener(onCommand);
    browser.composeAction.onClicked.addListener(onClicked);
    browser.storage.onChanged.addListener(onChanged);
    browser.composeScripts.register({
      js: [ {file: "content.js"}, ]
    });

    window.addEventListener('unload', () => {
        browser.commands.onCommand.removeListener(onCommand);
        browser.windows.onFocusChanged.removeListener(onFocusChanged);
        browser.composeAction.onClicked.removeListener(onClicked);
        browser.storage.onChanged.removeListener(onChanged);
    });
})();

function onFocusChanged(windowId) {
    currentWinId = windowId;
}

async function onCommand(command) {
    if (command === "textern.tb-trigger-feature") {
        browser.tabs.query({
            windowId: currentWinId,
            lastFocusedWindow: false,
            windowType: "messageCompose",
            active: true
        }).then(tabs => {
           setupRegisterDoc(tabs[0].id);
        }, logError)
    }
}

async function onClicked(tab) {
    // console.log("clicked:" + tab.id);
    setupRegisterDoc(tab.id);
}

async function onChanged(change) {
  browser.commands.update({
    name: "textern.tb-trigger-feature",
    shortcut:change.shortcut.newValue
  });
}

async function getSettings() {

    var rs;
    var hs = headers;

    await browser.storage.local.get([
            "editheaders",
            "editheaders_subject",
            "editheaders_to",
            "editheaders_cc",
            "editheaders_bcc",
            "editheaders_replyto",
            "editheaders_newsgroups",
            "editheaders_followupto",
            ]).then(r => {rs = r}, logError);

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

async function setupRegisterDoc(tid) {
    // Get the existing message.
    let details = await browser.compose.getComposeDetails(tid);
    var content = "";
    var [editHeaders, hs] = await getSettings();

    if (editHeaders) {
        for (let i in hs) {
            if (hs[i].s) {
                content += hs[i].v + ":"
                    + " ".repeat(11 - hs[i].v.length)
                    + details[hs[i].k] + newLine;
            }
        }
        content += splitLine
    }

    var subject;
    if (details.subject == "") {
        subject = "untitled";
    } else {
        subject = details.subject;
    }

    if (details.isPlainText) {
        // The message is being composed in plain text mode.
        content += details.plainTextBody;
        registerDoc(tid, 1, content, 0, subject);
    } else {
        let parser = new DOMParser()
        let html = parser.parseFromString(details.body, "text/html")
        let body = html.querySelector("body").innerHTML;
        content += body;
        registerDoc(tid, 0, content, 0, subject);
    }
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

function registerDoc(tid, isPlain, text, caret, subject) {

    var id = `${tid}_${isPlain}`;
    if (activeDocs.indexOf(id) != -1) {
        console.log(`Error: document id ${id} is already being edited`);
        notifyError("this text is already being edited");
        return;
    }

    activeDocs.push(id);
    if (port == undefined) {
        port = browser.runtime.connectNative("textern.tb");
        port.onMessage.addListener((response) => {
            handleNativeMessage(response);
        });
        port.onDisconnect.addListener((p) => {
            console.log("Disconnected from helper");
            if (p.error) {
                notifyError("connect to native application failed");
                logError(p.error);
            }
            activeDocs = [];
            port = undefined;
        });
    }

    browser.storage.local.get({
        editor: "[\"gedit\", \"+%l:%c\"]",
        extension: "eml"
    }).then(values => {
        if (port == undefined || port.error) {
            return;
        }
        port.postMessage({
            type: "new_text",
            payload: {
                id: id,
                text: text,
                caret: caret,
                subject: subject,
                prefs: {
                    editor: values.editor,
                    extension: values.extension
                }
            }
        });
    }, logError);
}

