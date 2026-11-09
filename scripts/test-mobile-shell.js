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
const responsiveCss = read("css/10-responsive.css");
const facilitiesCss = read("css/13-facilities.css");
const mobileFacilitiesCss = facilitiesCss.slice(facilitiesCss.indexOf('@media (max-width: 640px)'));
const squareMobileCss = facilitiesCss.slice(facilitiesCss.lastIndexOf('@media (max-width: 640px)'));

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
for (const id of ["btn-tab-gate", "btn-tab-guild", "btn-tab-kitchen", "btn-tab-workshop", "btn-tab-square"]) {
    assert(indexHtml.includes(`id="${id}"`), `village navigation is missing one of its five location tabs: ${id}`);
}
assert(indexHtml.includes('class="gate-departure-copy--desktop"'), "desktop retains the original gate departure instruction");
assert(indexHtml.includes('class="gate-departure-copy--mobile"'), "mobile has a departure instruction that points to the fixed bottom action");
assert(indexHtml.includes('使用畫面底部「進入地下城」按鈕'), "mobile gate instruction does not direct players toward the hidden desktop sidebar");
assert(indexHtml.includes('class="gate-mobile-context"'), "gate includes a dedicated compact context for mobile players");
assert(indexHtml.includes('id="gate-current-floor"') && indexHtml.includes('id="gate-environment-status"'), "gate context exposes current floor and environment fields");

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
for (const contract of [
    'let currentSquareTab = "chat";',
    "function syncVillageSquareTabPresentation()",
    "function syncVillageGateContext()",
    "function switchVillageSquareTab(tabName",
    "function renderVillageSquare()",
    "tab.setAttribute('aria-selected', String(selected))",
    "panel.setAttribute('aria-hidden', String(inactiveOnMobile))",
    "panel.inert = inactiveOnMobile",
    "if (floor) floor.textContent = `🎯 目標樓層：B${targetFloor}F`",
    "if (environment) environment.textContent = environmentData?.logText",
    "event.key === 'ArrowRight'",
    'role="tablist" aria-label="廣場功能"',
    'id="square-chat-box" class="square-chat-box" role="log"',
    "syncVillageSquareTabPresentation();",
    "目標樓層 B${targetFloor}F"
]) {
    assert(uiJs.includes(contract), `ui.js is missing square or gate mobile integration: ${contract}`);
}
assert(uiJs.includes("document.getElementById('battle-command-skills')?.setAttribute('aria-expanded', String(kind === \"skills\"))"), "skill menu state must be announced to assistive technology");
assert(uiJs.includes("document.getElementById('battle-command-items')?.setAttribute('aria-expanded', String(kind === \"items\"))"), "item menu state must be announced to assistive technology");
assert(uiJs.includes("rewardBox.classList?.remove('is-abyss-event-card')"), "non-event rewards must not retain compact event styling");
assert(gameJs.includes("rewardBox?.classList?.remove('is-abyss-event-card')"), "rest-shop rewards clear compact event styling before reusing the reward panel");
assert(gameJs.includes("mobileTrigger.setAttribute('aria-expanded', String(expanded))"), "the mobile tactics entry must stay synchronized with the tactics drawer");
assert(uiJs.includes("function ensureVillageNavTabVisible(tab)"), "mobile village tabs scroll into view when a new location is selected");
assert(uiJs.includes("ensureVillageNavTabVisible(DOM.get(tabs[targetLoc]))"), "village location selection invokes its visibility synchronization helper");
assert(uiJs.includes("target.dataset.metricCount = String(metrics.length)"), "facility overview exposes its metric count for responsive layout selection");
assert(uiJs.includes("const skillType = skill.type === 'passive' ? '被動常駐' : '主動技能';"), "compact skill rows do not repeat MP values that belong in the details card");
assert(uiJs.includes("card.tabIndex = 0;"), "guild skill details can be opened through keyboard focus");
assert(uiJs.includes("learnButton.classList.add('guild-skill-card__upgrade')"), "guild upgrade actions expose a mobile-specific compact button hook");
assert(uiJs.includes("learnButton.disabled = isDisabled;"), "guild upgrade buttons retain all existing eligibility checks");
assert(uiJs.includes("主動技能 (MP: ${skill.mp || 0})"), "skill details retain active-skill MP costs");
assert(uiJs.includes("當前威力: ${currentEffect}"), "skill details retain current effect values");
assert(uiJs.includes("下級突破: ${nextEffect}"), "skill details retain next-level effect values");
assert(uiJs.includes("guild-reset-options\" aria-expanded=\"${!isMobileGuild}"), "guild reset disclosure starts with viewport-aware ARIA state");
assert(uiJs.includes("resetToggle.setAttribute('aria-expanded', String(!isCollapsed))"), "guild reset disclosure keeps ARIA synchronized after toggling");
assert(uiJs.includes("resetSection.classList.add('is-collapsed')"), "guild reset actions start collapsed on mobile");
assert.match(gameJs, /function executeResetStats\(\)[\s\S]*?currentRun\.gold -= 300;/, "stat reset keeps its existing 300G cost");
assert.match(gameJs, /function executeReselectJob\(newJobId\)[\s\S]*?currentRun\.gold -= 1000;[\s\S]*?accountMeta\.lv = 1;/, "job reselection keeps its 1,000G cost and level-one reset outcome");

for (const contract of [
    "function createFacilityWarehouseDisclosure(",
    "function appendFacilityFocusNavigation(",
    "contentId: 'kitchen-warehouse-content'",
    "contentId: 'workshop-warehouse-content'",
    "aria-label', '依料理用途篩選食譜'",
    "activeCookingUseFilter === 'all' || useKey === activeCookingUseFilter",
    "activeCookingRecipeFocusIndex = Math.min(Math.max(activeCookingRecipeFocusIndex, 0), filteredRecipes.length - 1)",
    "activeWorkshopBlueprintFocusIndex = Math.min(Math.max(activeWorkshopBlueprintFocusIndex, 0), filteredBlueprints.length - 1)",
    "card.dataset.focusIndex = String(index)",
    "onToggle: (expanded) => { kitchenWarehouseExpanded = expanded; }",
    "onToggle: (expanded) => { workshopWarehouseExpanded = expanded; }"
]) {
    assert(uiJs.includes(contract), `ui.js is missing cooking/workshop mobile presentation contract: ${contract}`);
}
assert.match(uiJs, /toggle\.setAttribute\('aria-expanded', String\(nextExpanded\)\)/, "warehouse disclosure exposes its expanded state to assistive technology");
assert.match(uiJs, /filterRow\.setAttribute\('role', 'group'\)/, "warehouse category filters are grouped semantically");
assert.match(uiJs, /card\.setAttribute\('aria-label', `\$\{recipe\.name\}[\s\S]*?食譜詳情/, "recipe focus cards have a keyboard-friendly accessible label");
assert.match(uiJs, /card\.setAttribute\('aria-label', `\$\{blueprint\.name\}[\s\S]*?強化費用/, "blueprint focus cards have a keyboard-friendly accessible label");

assert(mobileCss.includes('@media screen and (max-width: 640px)'), "mobile shell CSS must be isolated to the mobile breakpoint");
assert(mobileCss.includes('env(safe-area-inset-bottom, 0px)'), "mobile shell must reserve iPhone safe-area space");
assert(mobileCss.includes('max-height: calc(100dvh'), "mobile drawer must account for mobile browser viewport height");
assert(mobileCss.includes('#mobile-hud-action-slot #action-panel-box'), "mobile HUD must scope action-panel overrides to its portal");
assert.match(mobileCss, /#mobile-hud-action-slot #action-panel-box #btn-main-action\s*\{[^}]*min-height:\s*44px\s*!important/s, "mobile main departure action meets the 44px touch target");
assert(mobileCss.includes('#mobile-hud-action-slot .battle-command-panel'), "manual battle controls must use the bottom HUD layout after portal placement");
assert(mobileCss.includes('max-height: min(24dvh, 165px)'), "skill and item options must remain scrollable within the fixed HUD");
assert.match(mobileCss, /\.route-choice-details > summary\s*\{[^}]*min-height:\s*44px/s, "mobile route details control meets the 44px touch target");
assert.match(mobileCss, /\.is-abyss-event-card \.abyss-event-details > summary\s*\{[^}]*min-height:\s*44px/s, "mobile event details control meets the 44px touch target");
assert.match(mobileCss, /\.is-abyss-event-card #reward-choices-container > button\s*\{[^}]*min-height:\s*44px\s*!important/s, "mobile event choices override the legacy button height and meet 44px");
assert(mobileCss.includes('body.mobile-shell-active .left-layout-column'), "mobile mode must hide the empty source column only when active");
assert(mobileCss.includes('@media screen and (min-width: 641px)'), "desktop route/event rendering must keep separate presentation rules");
assert(responsiveCss.includes('@media (max-width: 640px)'), "single-row village navigation is isolated to the phone breakpoint");
assert.match(responsiveCss, /\.village-nav-bar\s*\{[^}]*flex-wrap:\s*nowrap/s, "mobile village navigation remains on a single horizontal row");
assert.match(responsiveCss, /\.village-nav-bar\s*>\s*\.btn-nav-tab\s*\{[^}]*flex:\s*0 0 auto/s, "mobile village tabs keep their natural width for horizontal scrolling");
assert.match(mobileFacilitiesCss, /\.facility-overview\[data-metric-count="4"\]\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*grid-template-rows:\s*repeat\(2/s, "four facility metrics use a two-column, two-row mobile grid");
assert.match(mobileFacilitiesCss, /\.facility-description\s*\{[^}]*padding-left:\s*44px/s, "mobile facility description remains aligned with the compact title text");
assert.match(mobileFacilitiesCss, /\.facility-hero-icon\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/s, "facility hero icons shrink only in the mobile layout");
assert.match(mobileFacilitiesCss, /\.facility-metric-label,\s*\.facility-metric-value\s*\{[^}]*white-space:\s*normal/s, "mobile facility values wrap instead of being truncated");
assert(mobileFacilitiesCss.includes("grid-template-columns: minmax(0, 1fr) auto;"), "mobile guild skill cards use a compact text-plus-action row");
assert(mobileFacilitiesCss.includes(".guild-reset-section.is-collapsed .guild-reset-section__content"), "mobile guild reset options can collapse without hiding desktop controls");
assert(facilitiesCss.includes(".guild-reset-section__toggle {\n    display: none;"), "desktop keeps its original visible guild reset actions instead of a mobile toggle");
assert.match(mobileFacilitiesCss, /\.facility-warehouse-disclosure\.is-collapsed \.facility-warehouse-disclosure__content\s*\{\s*display:\s*none/s, "mobile warehouse contents collapse without removing the always-visible summary");
assert.match(mobileFacilitiesCss, /\.facility-filter-bar\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "kitchen and workshop filters remain a compact two-control row on mobile");
assert.match(mobileFacilitiesCss, /\.warehouse-filter-row\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/s, "warehouse category filters scroll inside one row on narrow screens");
assert.match(mobileFacilitiesCss, /\.recipe-card:not\(\.is-focus-card\),\s*\.workshop-blueprint-card:not\(\.is-focus-card\)\s*\{\s*display:\s*none/s, "mobile shows only the selected recipe or blueprint focus card");
assert.match(mobileFacilitiesCss, /\.facility-focus-nav__button\s*\{[^}]*min-height:\s*44px/s, "focus-card navigation meets the minimum mobile touch target");
assert.match(mobileFacilitiesCss, /\.facility-panel--guild,[\s\S]*?\.facility-panel--kitchen,[\s\S]*?\.facility-panel--workshop\s*\{[^}]*padding-bottom:[^}]*--mobile-hud-reserve/s, "guild, kitchen and workshop reserve enough mobile scroll clearance above the fixed HUD");
assert.match(mobileFacilitiesCss, /\.square-facility-stack\s*\{[^}]*padding-bottom:[^}]*--mobile-hud-reserve/s, "square chat can scroll its composer above the fixed mobile HUD");
assert(facilitiesCss.includes(".facility-focus-nav {\n    display: none;"), "desktop retains the complete recipe and blueprint list without phone paging controls");
assert.match(squareMobileCss, /\.square-mobile-tabs\s*\{[^}]*display:\s*grid/s, "phone square subtabs appear only in the mobile layout");
assert.match(squareMobileCss, /\.square-mobile-tabs \[role="tab"\]\s*\{[^}]*min-height:\s*44px/s, "square subtabs meet the mobile touch target");
assert.match(squareMobileCss, /#v-loc-square \.square-tab-panel:not\(\.is-active\)\s*\{[^}]*display:\s*none/s, "phone square exposes only one active subpanel");
assert.match(squareMobileCss, /#v-loc-square \.square-chat-box\s*\{[^}]*height:\s*clamp\(120px,\s*24dvh,\s*200px\)[^}]*overflow-y:\s*auto/s, "phone chat history scrolls in a bounded-height message area");
assert.match(squareMobileCss, /#v-loc-square \.square-chat-input\s*\{[^}]*min-height:\s*44px[^}]*font-size:\s*16px/s, "mobile chat input avoids tiny touch height and iOS focus zoom");
assert.match(squareMobileCss, /#v-loc-square \.square-market-open,[\s\S]*?min-height:\s*44px/s, "market entry and chat send actions remain touch-sized");
assert.match(facilitiesCss, /@media \(min-width: 641px\)\s*\{[\s\S]*?#v-loc-square \.square-tab-panel\s*\{[^}]*display:\s*block !important/s, "desktop restores both original square panels simultaneously");
assert.match(facilitiesCss, /\.gate-mobile-context\s*\{\s*display:\s*none/s, "gate context remains absent from the unchanged desktop layout");
assert.match(squareMobileCss, /\.gate-mobile-context\s*\{[^}]*display:\s*grid/s, "mobile gate exposes floor and environment context");

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

console.log("✅ Mobile portal, desktop restoration, dynamic HUD reserve, route/event cards, guild controls, and kitchen/workshop warehouse/focus/filter contracts passed.");
