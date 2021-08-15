/* vim: set et ts=4 sts=4 sw=4 tw=92:
 * Copyright (C) 2017-2018  Jonathan Lebon <jonathan@jlebon.com>
 * This file is part of Textern.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";

function onError(error) {
    console.log(`Error: ${error}`);
}

function saveOptions(e) {
    e.preventDefault();

    var editheaders = document.querySelector("#editheaders")
    var count = 0;

    document.querySelectorAll("form > fieldset > div > input").forEach(
        function(value, key, listObj, argument) {
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

function clearCheckmark(e) {
    document.querySelector("#saved").innerHTML = "";
}

async function restoreOptions() {

    await Promise.all([
        (async ()=>await  browser.storage.local.get("editor").then(r => {
            document.querySelector("#editor").value = r.editor || "[\"gedit\", \"+%l:%c\"]";
        }, onError))(),
        (async ()=>await  browser.storage.local.get("shortcut").then(r => {
            document.querySelector("#shortcut").value = r.shortcut || "Ctrl+E";
        }, onError))(),
        (async ()=>await  browser.storage.local.get("extension").then(r => {
            document.querySelector("#extension").value = r.extension || "eml";
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders").then(r => {
            document.querySelector("#editheaders-fieldset").disabled = !r.editheaders;
            document.querySelector("#editheaders").checked = r.editheaders;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_subject").then(r => {
            document.querySelector("#subject").checked = r.editheaders_subject;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_to").then(r => {
            document.querySelector("#to").checked = r.editheaders_to;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_cc").then(r => {
            document.querySelector("#cc").checked = r.editheaders_cc;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_bcc").then(r => {
            document.querySelector("#bcc").checked = r.editheaders_bcc;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_replyto").then(r => {
            document.querySelector("#replyto").checked = r.editheaders_replyto;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_newsgroups").then(r => {
            document.querySelector("#newsgroups").checked = r.editheaders_newsgroups;
        }, onError))(),
        (async ()=>await  browser.storage.local.get("editheaders_followupto").then(r => {
            document.querySelector("#followupto").checked = r.editheaders_followupto;
        }, onError))(),
    ]);
}

function editheadersFieldsetToggle(e) {
  document.querySelector("#editheaders-fieldset").disabled = !e.checked;
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelectorAll("form > input").forEach(
    function(value, key, listObj, argument) {
        value.addEventListener("input", clearCheckmark);
    }
);

document.querySelectorAll("form > fieldset").forEach(
    function(value, key, listObj, argument) {
        value.addEventListener("change", clearCheckmark);
    }
);

document.querySelector("#editheaders").addEventListener("change", (e) => {
  editheadersFieldsetToggle(e.target);
});

