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

    await browser.storage.local.get("editor").then(result => {
        document.querySelector("#editor").value =
            result.editor || "[\"gedit\", \"+%l:%c\"]";
    }, onError);

    await browser.storage.local.get("shortcut").then(result => {
        document.querySelector("#shortcut").value = result.shortcut || "Ctrl+E";
    }, onError);

    await browser.storage.local.get("extension").then(result => {
        document.querySelector("#extension").value = result.extension || "eml";
    }, onError);

    await browser.storage.local.get("editheaders").then(result => {
        document.querySelector("#editheaders-fieldset").disabled = !result.editheaders;
        document.querySelector("#editheaders").checked = result.editheaders;
    }, onError);

    await browser.storage.local.get("editheaders_subject").then(result => {
        document.querySelector("#subject").checked = result.editheaders_subject;
    }, onError);

    await browser.storage.local.get("editheaders_to").then(result => {
        document.querySelector("#to").checked = result.editheaders_to;
    }, onError);

    await browser.storage.local.get("editheaders_cc").then(result => {
        document.querySelector("#cc").checked = result.editheaders_cc;
    }, onError);

    await browser.storage.local.get("editheaders_bcc").then(result => {
        document.querySelector("#bcc").checked = result.editheaders_bcc;
    }, onError);

    await browser.storage.local.get("editheaders_replyto").then(result => {
        document.querySelector("#replyto").checked = result.editheaders_replyto;
    }, onError);

    await browser.storage.local.get("editheaders_newsgroups").then(result => {
        document.querySelector("#newsgroups").checked = result.editheaders_newsgroups;
    }, onError);

    await browser.storage.local.get("editheaders_followupto").then(result => {
        document.querySelector("#followupto").checked = result.editheaders_followupto;
    }, onError);
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

