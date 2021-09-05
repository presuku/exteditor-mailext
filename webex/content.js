/* vim: set et ts=4 sts=4 sw=4 tw=92:
 * Copyright (C) 2021       presuku <presuku@gmail.com>
 * Copyright (C) 2017-2018  Jonathan Lebon <jonathan@jlebon.com>
 * This file is part of Textern for thunderbird.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";

function logError(error) {
    console.log(`${error}`);
}

function assertNoResponse(response) {
    console.assert(response == undefined);
}

function rgb(r, g, b) {
    return 'rgb(' + ([r, g, b].join()) + ')';
}

const ANIMATION_DURATION_S = 500.0;
const ANIMATION_N_STEPS = 10;

function fadeBackground(e) {
    if ("texternOrigBackgroundColor" in e)
        return; /* if there's already an animation in progress, don't start a new one */
    e.texternOrigBackgroundColor = e.style.backgroundColor;
    e.style.backgroundColor = rgb(255, 255, 0);
    let i = 0;
    const timerId = window.setInterval(function() {
        if (i < ANIMATION_N_STEPS) {
            e.style.backgroundColor = rgb(255, 255, i * (255 / ANIMATION_N_STEPS));
            i++;
        } else {
            e.style.backgroundColor = e.texternOrigBackgroundColor;
            delete e.texternOrigBackgroundColor;
            window.clearInterval(timerId);
        }
    }, ANIMATION_DURATION_S / ANIMATION_N_STEPS);
}

function setText(message) {
    const e = document.body;

    if (message.plain) {
        e.innerText = message.text;
    } else {
        // add deleted line feed after body tag in setupRegisterDoc() in backgraound.js.
        e.innerHTML = "\n" + message.text;
    }
    fadeBackground(e);
}

function getTopNode(s) {
    const pos = s.anchorNode.compareDocumentPosition(s.focusNode);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        return [s.anchorNode, s.anchorOffset];
    } else {
        return [s.focusNode, s.focusOffset];
    }
}

let saveNodeForRestore = {};
async function setMark(msg) {
    const tid = msg.tid
    const selection = window.getSelection();
    const [topNode, topOffset] = getTopNode(selection);

    let targetNode;
    let targetParentNode;
    let caretOffset;
    if (topNode.nodeType == 3) {
        targetNode = topNode;
        targetParentNode = topNode.parentElement;
        caretOffset = topOffset;
    } else {
        [targetNode, targetParentNode] = ((n) => {
            const l = n.childNodes.length;
            if (l == 0) {
                return [n, n.parentElement];
            } else {
                return [n.childNodes[topOffset], n];
            }
        })(topNode);

        caretOffset = 0;
    }

    const markText = "#+#+*#*#" + Date.now().toString() + "#*#*+#+#";
    const splitMarkNode = document.createElement("span");
    splitMarkNode.id = markText;
    const markHTML = splitMarkNode.outerHTML;

    targetParentNode.insertBefore(splitMarkNode, targetNode);

    saveNodeForRestore[tid] = [targetParentNode, splitMarkNode, selection];

    await browser.runtime.sendMessage("textern.tb@example.com", {
        type: "do_setup",
        tid: tid,
        mark_html: markHTML,
        mark_text: markText,
        caret_offset: caretOffset,
    }).then(assertNoResponse, logError);
}

function restoreHTML(msg) {
    const tid = msg.tid;
    const [targetParentNode, splitMarkNode, selection] = saveNodeForRestore[tid];
    const [topNode, topOffset] = getTopNode(selection);

    targetParentNode.removeChild(splitMarkNode);

    // restore caret position
    const range = selection.getRangeAt(0);
    range.setStart(topNode, topOffset);
    range.setEnd(topNode, topOffset);

    saveNodeForRestore[tid] = [];
}

async function onMessage(message, sender) {
    if (sender.id != "textern.tb@example.com")
        return;
    if (message.type == "set_text") {
        setText(message);
    } else if (message.type == "set_mark") {
        setMark(message);
    } else if (message.type == "restore_html") {
        restoreHTML(message);
    } else {
        console.log(`Unknown message type: ${message.type}`);
    }
}

(async () => {
    browser.runtime.onMessage.addListener(onMessage);

    window.addEventListener('unload', () => {
        browser.runtime.onMessage.removeListener(onMessage);
    });
})();

