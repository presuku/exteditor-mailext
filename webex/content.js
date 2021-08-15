/* vim: set et ts=4 sts=4 sw=4 tw=92:
 * Copyright (C) 2021       presuku <presuku@gmail.com>
 * Copyright (C) 2017-2018  Jonathan Lebon <jonathan@jlebon.com>
 * This file is part of Textern for thunderbird.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";

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
    var i = 0;
    var timerId = window.setInterval(function() {
        if (i < ANIMATION_N_STEPS) {
            e.style.backgroundColor = rgb(255, 255, i*(255/ANIMATION_N_STEPS));
            i++;
        } else {
            e.style.backgroundColor = e.texternOrigBackgroundColor;
            delete e.texternOrigBackgroundColor;
            window.clearInterval(timerId);
        }
    }, ANIMATION_DURATION_S / ANIMATION_N_STEPS);
}

function setText(message) {
    var e = document.body;

    if (message.plain) {
        e.textContent = message.text;
    } else {
        e.innerHTML = message.text;
    }
    fadeBackground(e);
}

function onMessage(message, sender, respond) {
    if (sender.id != "textern.tb@example.com")
        return;
    if (message.type == "set_text") {
        setText(message);
        console.log(`set_text message type: ${message.type}`);
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

