/* vim: set et ts=4 sts=4 sw=4 tw=92:
 * Copyright (C) 2017-2018  Jonathan Lebon <jonathan@jlebon.com>
 * This file is part of Textern.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";

function logError(error) {
    console.log(`${error}`);
}

function saveOptions(e) {
    e.preventDefault();

    var editheaders = document.querySelector("#editheaders")
    var count = 0;

    document.querySelectorAll("form > fieldset > div > input").forEach(
        function(value) {
            if (value.checked) {
                count += 1;
            }
        }
    )

    if (count == 0) {
        editheadersFieldsetToggle(editheaders);
        editheaders.checked = false;
    }

    browser.storage.local.set({
        editor: document.querySelector("#editor").value,
        shortcut: document.querySelector("#shortcut").value,
        extension: document.querySelector("#extension").value,
        editheaders: editheaders.checked,
        editheaders_subject: document.querySelector("#subject").checked,
        editheaders_to: document.querySelector("#to").checked,
        editheaders_cc: document.querySelector("#cc").checked,
        editheaders_bcc: document.querySelector("#bcc").checked,
        editheaders_replyto: document.querySelector("#replyto").checked,
        editheaders_newsgroups: document.querySelector("#newsgroups").checked,
        editheaders_followupto: document.querySelector("#followupto").checked,
    });
    document.querySelector("#saved").innerHTML = '\u2713';
}

function clearCheckmark() {
    document.querySelector("#saved").innerHTML = "";
}

async function restoreOptions() {
    let r = await browser.storage.local.get({
        editor: "",
        shortcut: "",
        extension: "",
        editheaders: false,
        editheaders_subject: false,
        editheaders_to: false,
        editheaders_cc: false,
        editheaders_bcc: false,
        editheaders_replyto: false,
        editheaders_newsgroups: false,
        editheaders_followupto: false,
    }).catch(logError);
    await Promise.all([
        (async () => { document.querySelector("#editor").value = r.editor || "[\"gedit\", \"+%l:%c\"]"; })(),
        (async () => { document.querySelector("#shortcut").value = r.shortcut || "Ctrl+E"; })(),
        (async () => { document.querySelector("#extension").value = r.extension || "eml"; })(),
        (async () => { document.querySelector("#editheaders-fieldset").disabled = !r.editheaders; })(),
        (async () => { document.querySelector("#editheaders").checked = r.editheaders; })(),
        (async () => { document.querySelector("#subject").checked = r.editheaders_subject; })(),
        (async () => { document.querySelector("#to").checked = r.editheaders_to; })(),
        (async () => { document.querySelector("#cc").checked = r.editheaders_cc; })(),
        (async () => { document.querySelector("#bcc").checked = r.editheaders_bcc; })(),
        (async () => { document.querySelector("#replyto").checked = r.editheaders_replyto; })(),
        (async () => { document.querySelector("#newsgroups").checked = r.editheaders_newsgroups; })(),
        (async () => { document.querySelector("#followupto").checked = r.editheaders_followupto; })(),
    ]);
}

function editheadersFieldsetToggle(e) {
    document.querySelector("#editheaders-fieldset").disabled = !e.checked;
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelectorAll("form > input").forEach(
    function(value) {
        value.addEventListener("input", clearCheckmark);
    }
);

document.querySelectorAll("form > fieldset").forEach(
    function(value) {
        value.addEventListener("change", clearCheckmark);
    }
);

document.querySelector("#editheaders").addEventListener("change", (e) => {
    editheadersFieldsetToggle(e.target);
});

