#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const cardEngine = ui.match(/let touchCardTimer = null;[\s\S]*?(?=\n\/\/ -{10,}\n\/\/ ✨ 4\.)/);
assert.ok(cardEngine, "the production floating-card engine is available for touch testing");

function createClassList() {
    const values = new Set();
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        contains(value) { return values.has(value); }
    };
}

function createHarness() {
    const timers = new Map();
    const clickHandlers = [];
    let nextTimerId = 0;
    const card = { classList: createClassList(), style: {}, innerHTML: "" };
    const button = {
        addEventListener(type, handler) {
            if (type === "click") clickHandlers.push(handler);
        },
        getBoundingClientRect() { return { left: 20, top: 20, width: 120, height: 32 }; }
    };
    const sandbox = {
        document: {
            body: { appendChild() {} },
            getElementById(id) { return id === "floating-item-card" ? card : null; },
            createElement() { return card; }
        },
        window: { innerWidth: 390, innerHeight: 844 },
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        Date
    };
    vm.createContext(sandbox);
    vm.runInContext(`${cardEngine[0]}\nthis.bind = bindFloatingCard;\nthis.hide = hideFloatingCard;`, sandbox);
    sandbox.bind(button, () => ({ title: "技能名稱", type: "戰鬥技能", desc: "技能詳細說明" }));
    return {
        sandbox,
        card,
        button,
        clickHandlers,
        timers,
        fireTimer(delay) {
            const item = [...timers.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(item, `a ${delay} ms timer is pending`);
            timers.delete(item[0]);
            item[1].callback();
        }
    };
}

const touch = { touches: [{ clientX: 110, clientY: 230 }] };

const shortTap = createHarness();
shortTap.button.ontouchstart(touch);
shortTap.button.ontouchend();
shortTap.button.onmouseenter({}); // Mobile Safari/Chrome may synthesize this after touch.
assert.equal(shortTap.card.classList.contains("active"), false, "a short tap does not leave a synthetic-hover card open");
assert.equal(shortTap.timers.size, 0, "short taps cancel the pending long-press timer");

const selectedSkill = createHarness();
selectedSkill.button.ontouchstart(touch);
selectedSkill.fireTimer(220);
assert.equal(selectedSkill.card.classList.contains("active"), true, "long press can reveal skill details");
selectedSkill.button.ontouchend();
selectedSkill.button.onmouseenter({});
assert.equal(selectedSkill.card.classList.contains("active"), true, "a touch-generated mouseenter does not toggle the card lifecycle");
selectedSkill.clickHandlers.forEach((handler) => handler());
assert.equal(selectedSkill.card.classList.contains("active"), false, "selecting the skill immediately closes its details card");
assert.equal(selectedSkill.timers.size, 0, "selection clears the pending auto-dismiss timer");

const abandonedDetails = createHarness();
abandonedDetails.button.ontouchstart(touch);
abandonedDetails.fireTimer(220);
abandonedDetails.button.ontouchend();
assert.equal(abandonedDetails.card.classList.contains("active"), true, "details remain briefly readable after releasing a long press");
abandonedDetails.fireTimer(1400);
assert.equal(abandonedDetails.card.classList.contains("active"), false, "untouched details automatically dismiss after release");

console.log("Floating card touch tests passed: short tap, long-press details, skill-selection dismissal, synthetic hover suppression, and auto-dismiss.");
