#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const indexHtml = read("index.html");
const uiJs = read("js/ui.js");
const gameJs = read("js/game.js");
const mobileCss = read("css/14-mobile-shell.css");
const combatCss = read("css/12-combat-scene.css");

[
    "mobile-bottom-hud",
    "mobile-latest-log",
    "mobile-hud-action-slot",
    "mobile-drawer-scrim",
    "mobile-shell-drawer",
    "mobile-character-drawer",
    "mobile-log-drawer",
    "battle-command-panel",
    "battle-command-categories",
    "battle-command-options",
    "battle-command-skills",
    "battle-command-items",
    "battle-command-back",
    "tactics-drawer-box",
    "route-choices-container",
    "reward-panel-box",
    "reward-choices-container"
].forEach((id) => {
    assert(indexHtml.includes(`id="${id}"`), `index.html is missing required mobile shell element: ${id}`);
});

assert(indexHtml.includes('href="css/14-mobile-shell.css"'), "index.html must load the mobile shell stylesheet");
assert(indexHtml.indexOf('href="css/14-mobile-shell.css"') > indexHtml.indexOf('href="css/12-combat-scene.css"'), "mobile shell stylesheet must load after existing responsive and combat styles");
assert.match(indexHtml, /battle-command-skills[^>]*aria-controls="battle-command-options"[^>]*aria-expanded="false"/, "skill category exposes its controlled option menu");
assert.match(indexHtml, /battle-command-items[^>]*aria-controls="battle-command-options"[^>]*aria-expanded="false"/, "item category exposes its controlled option menu");
assert.match(indexHtml, /id="battle-command-options"[^>]*role="group"/, "command options have a semantic group role");

[
    "function initMobileShell()",
    "function syncMobileShellPlacement()",
    "function syncMobileShellUI()",
    "function openMobileDrawer(",
    "function closeMobileDrawer(",
    "function syncMobileLatestLog(",
    "function syncMobileManualCommandState(",
    "moveMobileShellElement('status', 'status-panel-box', 'mobile-character-drawer')",
    "moveMobileShellElement('action', 'action-panel-box', 'mobile-hud-action-slot')",
    "moveMobileShellElement('battleCommands', 'battle-command-panel', 'mobile-hud-action-slot')",
    "moveMobileShellElement('log', 'log-wrapper-box', 'mobile-log-drawer')",
    "restoreMobileShellElement('battleCommands', 'battle-command-panel')",
    "tacticsButton.id = \"mobile-tactics-button\"",
    "tacticsButton.setAttribute('aria-controls', 'tactics-drawer-box')",
    "syncMobileLatestLog(diaryText);",
    "syncMobileManualCommandState(showManualCommands, commandOptions?.style.display === \"flex\")",
    "syncMobileManualCommandState(true, true)",
    "options.setAttribute('aria-label', kind === \"skills\" ? \"可用技能\" : \"可用道具\")"
].forEach((snippet) => {
    assert(uiJs.includes(snippet), `ui.js is missing mobile shell integration: ${snippet}`);
});

assert(uiJs.includes('MOBILE_SHELL_MEDIA_QUERY = "(max-width: 640px)"'), "mobile shell must stay scoped to <=640px");
assert(uiJs.includes("document.getElementById('battle-command-skills')?.setAttribute('aria-expanded', String(kind === \"skills\"))"), "skill menu state must be announced to assistive technology");
assert(uiJs.includes("document.getElementById('battle-command-items')?.setAttribute('aria-expanded', String(kind === \"items\"))"), "item menu state must be announced to assistive technology");
assert(uiJs.includes("rewardBox.classList?.remove('is-abyss-event-card')"), "non-event rewards must not retain compact event styling");
assert(gameJs.includes("rewardBox?.classList?.remove('is-abyss-event-card')"), "rest-shop rewards clear compact event styling before reusing the reward panel");
assert(gameJs.includes("mobileTrigger.setAttribute('aria-expanded', String(expanded))"), "the mobile tactics entry must stay synchronized with the tactics drawer");

assert(mobileCss.includes('@media screen and (max-width: 640px)'), "mobile shell CSS must be isolated to the mobile breakpoint");
assert(mobileCss.includes('env(safe-area-inset-bottom, 0px)'), "mobile shell must reserve iPhone safe-area space");
assert(mobileCss.includes('max-height: calc(100dvh'), "mobile drawer must account for mobile browser viewport height");
assert(mobileCss.includes('#mobile-hud-action-slot #action-panel-box'), "mobile HUD must scope action-panel overrides to its portal");
assert(mobileCss.includes('#mobile-hud-action-slot .battle-command-panel'), "manual battle controls must use the bottom HUD layout after portal placement");
assert(mobileCss.includes('max-height: min(24dvh, 165px)'), "skill and item options must remain scrollable within the fixed HUD");
assert(mobileCss.includes('body.mobile-shell-active .left-layout-column'), "mobile mode must hide the empty source column only when active");
assert(mobileCss.includes('@media screen and (min-width: 641px)'), "desktop route/event rendering must keep separate presentation rules");

const reserveRules = [...mobileCss.matchAll(/body\.mobile-shell-active\.mobile-manual-command-visible(\.mobile-manual-command-options-open)?\s*\{[^}]*--mobile-hud-reserve:\s*([^;]+);[^}]*\}/g)];
const reserveByState = new Map(reserveRules.map((match) => [Boolean(match[1]), match[2].trim()]));
assert.equal(reserveByState.get(false), "230px", "opening the manual command panel must raise the reserved HUD height");
assert.equal(reserveByState.get(true), "clamp(230px, 28dvh, 300px)", "opening skills or items must set a viewport-aware minimum before measuring actual content");

const stateHelper = uiJs.match(/function syncMobileManualCommandState\(visible, optionsVisible = false\) \{[\s\S]*?\n\}/);
assert.ok(stateHelper, "mobile manual command state helper must be testable");
let isMobile = true;
const bodyClasses = new Set();
const bodyStyles = new Map();
const hudElement = { getBoundingClientRect: () => ({ height: bodyClasses.has("mobile-manual-command-options-open") ? 358 : 230 }) };
const body = {
    classList: {
        toggle(name, enabled) {
            if (enabled) bodyClasses.add(name);
            else bodyClasses.delete(name);
        },
        contains(name) { return bodyClasses.has(name); }
    },
    style: {
        removeProperty(name) { bodyStyles.delete(name); },
        setProperty(name, value) { bodyStyles.set(name, value); }
    }
};
const context = {
    document: {
        body,
        getElementById(id) { return id === "mobile-bottom-hud" ? hudElement : null; }
    },
    window: { requestAnimationFrame(callback) { callback(); } },
    isMobileShellViewport: () => isMobile
};
vm.createContext(context);
vm.runInContext(`${stateHelper[0]}\nthis.sync = syncMobileManualCommandState;`, context);
context.sync(true, true);
assert.ok(bodyClasses.has("mobile-manual-command-visible"), "manual command open state activates the HUD reserve selector");
assert.ok(bodyClasses.has("mobile-manual-command-options-open"), "skill/item drawer open state activates the taller HUD reserve selector");
assert.equal(bodyStyles.get("--mobile-hud-reserve"), "358px", "expanded options reserve their measured content height");
context.sync(true, false);
assert.ok(bodyClasses.has("mobile-manual-command-visible"), "closing skill/item choices keeps the manual command HUD visible");
assert.ok(!bodyClasses.has("mobile-manual-command-options-open"), "closing skill/item choices restores the smaller HUD reserve");
assert.equal(bodyStyles.get("--mobile-hud-reserve"), "230px", "closing options measures and restores the smaller manual HUD height");
context.sync(false, false);
assert.ok(!bodyClasses.has("mobile-manual-command-visible"), "leaving manual input clears the manual HUD reserve");
assert.ok(!bodyClasses.has("mobile-manual-command-options-open"), "leaving manual input clears the expanded-menu reserve");
assert.equal(bodyStyles.has("--mobile-hud-reserve"), false, "leaving manual input removes its inline reserve so normal CSS is restored");
isMobile = false;
context.sync(true, true);
assert.equal(bodyClasses.size, 0, "desktop viewport must never activate mobile HUD reserve states");

for (const className of [
    "route-choice-card",
    "route-choice-title-line",
    "route-choice-type",
    "route-choice-index",
    "route-choice-details",
    "route-choice-full-desc",
    "route-choice-clue",
    "route-choice-metrics",
    "route-choice-select",
    "abyss-event-one-line-summary",
    "abyss-event-details",
    "abyss-event-full-description"
]) {
    assert(gameJs.includes(className), `game.js is missing route/event compact presentation contract: ${className}`);
}
assert.match(gameJs, /function getAbyssEventOneLineSummary\(description\)/, "event summary text is extracted as a separate mobile line");
assert.match(gameJs, /eventDetails\.open = !\(typeof isMobileShellViewport === "function" && isMobileShellViewport\(\)\)/, "full event description remains open on desktop and collapsible on mobile");
assert.match(gameJs, /if \(event\?\.target\?\.closest\?\.\('\.route-choice-select, \.route-choice-details'\)\) return;/, "route-card clicks do not trigger selection through details or select-button bubbling");
assert.match(gameJs, /selectButton\.onclick = \(event\) => \{[\s\S]*?selectRouteNode\(idx\);/, "explicit mobile selection button reuses the original route settlement function");
assert.match(gameJs, /rewardBox\.classList\?\.add\('is-abyss-event-card'\)/, "event presentation is scoped to the active event reward card");
assert.match(mobileCss, /\.route-choice-select\s*\{[\s\S]*?min-height:\s*44px/, "route selection provides a dedicated touch target");
assert.match(mobileCss, /\.is-abyss-event-card #reward-choices-container > button\s*\{[\s\S]*?min-height:\s*44px/, "event choices remain touch-friendly on mobile");
assert.match(combatCss, /\.battle-command-panel\s*\{/, "existing desktop command panel remains in the combat scene stylesheet");

console.log("✅ Mobile portal, desktop restoration guards, dynamic HUD reserve, route cards, and event card contracts passed.");
