#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/12-combat-scene.css"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");

for (const id of [
    "battle-scene-box", "battle-monster-vfx-anchor", "battle-attack-swipe", "battle-monster-sprite", "battle-monster-fallback",
    "battle-player-hp-bar", "battle-player-mp-bar", "battle-monster-hp-bar",
    "battle-player-atb-text", "battle-player-atb-bar", "battle-monster-atb-text", "battle-monster-atb-bar",
    "battle-scene-log-line-1", "battle-scene-log-line-2", "battle-item-queue-status"
]) {
    assert.match(html, new RegExp(`id="${id}"`), `battle scene HTML includes #${id}`);
}
assert.match(html, /css\/12-combat-scene\.css/, "battle scene stylesheet is loaded");
assert.match(css, /@media \(max-width: 600px\)/, "battle scene has a mobile layout");
assert.match(css, /prefers-reduced-motion/, "battle scene respects reduced motion preferences");
assert.match(css, /@keyframes first-person-attack/, "first-person slash has an animation");
assert.match(css, /@keyframes diary-caret/, "battle diary has a typewriter cursor animation");
assert.match(ui, /new Intl\.Segmenter\("zh-Hant", \{ granularity: "grapheme" \}\)/, "typewriter reveals Chinese characters by grapheme");
assert.doesNotMatch(ui, /battle-player-sprite/, "the player sprite is removed from UI element caching");
assert.doesNotMatch(html, /battle-player-sprite|hero-knight\.png|battle-versus/, "battle stage displays no player character or versus marker");
assert.match(html, /最近兩則戰鬥日記/, "scene shows recent battle diary entries");
assert.match(ui, /function syncBattleSceneLog\(message, logType = "deal"\)/, "diary entries are synchronized with their log type");
assert.match(ui, /function getBattleDiaryTone\(text, logType = "deal"\)/, "diary entries receive combat-state colors");
assert.match(ui, /發現魔物/, "a new encounter resets the scene diary");
assert.match(ui, /VICTORY!/, "victory text is retained at battle end");
assert.match(ui, /你已被擊敗/, "defeat text is retained at battle end");
assert.match(ui, /battle-player-atb-text/, "player ATB is rendered in the scene HUD");
assert.match(ui, /battle-monster-atb-text/, "monster ATB is rendered in the scene HUD");
assert.match(ui, /queueCombatItemUse\(i\)/, "clicking a bag item queues it for the next player ATB turn");
assert.match(ui, /下次我方 ATB 行動時使用/, "the bag explains when a queued item will be used");
assert.match(css, /battle-log-line--critical/, "critical messages have a distinct color");
assert.match(css, /battle-log-line--damage/, "damage messages have a distinct color");
const typingSource = ui.match(/function setBattleDiaryLine\(element, index, entry, animate\) \{[\s\S]*?\n\}/);
assert.ok(typingSource, "battle diary typewriter renderer exists");
let typingTick = null;
const typingElement = {
    dataset: {}, textContent: "",
    classList: { add() {}, remove() {} }
};
const typingSandbox = {
    Intl,
    prefersReducedMotion: () => false,
    setInterval(callback) { typingTick = callback; return 1; },
    clearInterval() {}
};
vm.createContext(typingSandbox);
vm.runInContext(`let battleSceneTypingTimers = [null, null]; ${typingSource[0]}; this.typeLine = setBattleDiaryLine;`, typingSandbox);
typingSandbox.typeLine(typingElement, 0, { text: "A漢字", tone: "attack" }, true);
assert.equal(typingElement.textContent, "", "animated diary line starts empty");
typingTick();
assert.equal(typingElement.textContent, "A", "first grapheme appears on the first typing tick");
typingTick();
assert.equal(typingElement.textContent, "A漢", "second grapheme appears on the next typing tick");
typingTick();
assert.equal(typingElement.textContent, "A漢字", "diary line finishes after revealing every grapheme");
const vfx = fs.readFileSync(path.join(root, "js/vfx.js"), "utf8");
assert.match(vfx, /firstPersonAttack === true/, "VFX supports explicit first-person attacks");
assert.match(vfx, /battle-monster-vfx-anchor/, "monster VFX target the single on-screen enemy");
assert.match(fs.readFileSync(path.join(root, "js/game.js"), "utf8"), /firstPersonAttack: true, result: damageResult\.isCrit \? "crit" : "hit"/, "basic attacks and skills feed first-person combat feedback");
assert.match(ui, /updateBattleScene\(typeof activeMonster/, "regular UI updates sync the scene before state-specific early returns");

const variantSource = ui.match(/function getBattleMonsterSpriteVariant\(monster\) \{[\s\S]*?\n\}/);
assert.ok(variantSource, "monster sprite classification helper exists");
const sandbox = {};
vm.runInNewContext(`${variantSource[0]}; this.classify = getBattleMonsterSpriteVariant;`, sandbox);
assert.equal(sandbox.classify({ name: "💧 藍色史萊姆" }), "slime");
assert.equal(sandbox.classify({ name: "👻 迷途哭泣怨靈" }), "undead");
assert.equal(sandbox.classify({ name: "🔥 煉獄魔神", isBoss: true }), "demon");
assert.equal(sandbox.classify({ name: "👑 虛空領主", isBoss: true }), "", "non-demon bosses keep their existing icon");
assert.equal(sandbox.classify({ name: "👺 綠皮哥布林" }), "", "unmatched enemies use their existing icon fallback");

const toneSource = ui.match(/function getBattleDiaryTone\(text, logType = "deal"\) \{[\s\S]*?\n\}/);
assert.ok(toneSource, "battle diary tone classifier exists");
const logSource = ui.match(/function syncBattleSceneLog\(message, logType = "deal"\) \{[\s\S]*?\n\}/);
assert.ok(logSource, "two-line scene diary synchronizer exists");
const diaryElements = { "battle-scene-log-line-1": { textContent: "" }, "battle-scene-log-line-2": { textContent: "" } };
const diarySandbox = {
    Date,
    setTimeout: () => 1,
    clearTimeout: () => {},
    clearInterval: () => {},
    gameState: "BATTLE",
    activeMonster: { name: "💧 藍色史萊姆", hp: 0, maxHp: 100 },
    currentRun: { hp: 80, maxHp: 100, mp: 20, maxMp: 30 },
    playerAtb: 15,
    monsterAtb: 42,
    diaryElements,
    DOM: { get: (id) => diaryElements[id] || null }
};
vm.createContext(diarySandbox);
vm.runInContext(`let battleSceneLogLines = [];
let battleSceneTerminalUntil = 0;
let battleSceneTerminalSnapshot = null;
let battleSceneTerminalTimer = null;
let battleSceneTypingTimers = [null, null];
let battleSceneLogSequence = 0;
${toneSource[0]}
function renderBattleSceneLog() {
    diaryElements["battle-scene-log-line-1"].textContent = battleSceneLogLines[0]?.text || "發現魔物";
    diaryElements["battle-scene-log-line-2"].textContent = battleSceneLogLines[1]?.text || "戰鬥開始！";
}
${logSource[0]}
this.getLines = () => battleSceneLogLines;
this.syncDiary = syncBattleSceneLog;
this.snapshot = () => battleSceneTerminalSnapshot;`, diarySandbox);
diarySandbox.syncDiary("發現魔物：藍色史萊姆");
diarySandbox.syncDiary("勇者普通攻擊造成 8 傷害");
diarySandbox.syncDiary("史萊姆反擊造成 3 傷害", "take");
assert.deepEqual(Array.from(diarySandbox.getLines(), (entry) => entry.text), ["勇者普通攻擊造成 8 傷害", "史萊姆反擊造成 3 傷害"]);
assert.equal(diarySandbox.getLines()[0].tone, "attack");
assert.equal(diarySandbox.getLines()[1].tone, "damage");
diarySandbox.syncDiary("勇者觸發暴擊！造成 20 傷害");
assert.equal(diarySandbox.getLines()[1].tone, "critical");
diarySandbox.syncDiary("藥水回復 +50 HP", "perfect");
assert.equal(diarySandbox.getLines()[1].tone, "heal");
diarySandbox.syncDiary("討伐成功！ VICTORY! 獲得金幣 🪙 +28 G，經驗值 +25。");
assert.match(diarySandbox.getLines()[1].text, /VICTORY!/);
assert.equal(diarySandbox.snapshot().monster.name, "💧 藍色史萊姆");
diarySandbox.activeMonster = { name: "👹 深淵魔物", hp: 55, maxHp: 80 };
diarySandbox.currentRun.hp = 0;
diarySandbox.syncDiary("發現魔物：深淵魔物");
diarySandbox.syncDiary("你已被擊敗！損失經驗值並返回村莊。");
assert.match(diarySandbox.getLines()[1].text, /你已被擊敗/);
assert.equal(diarySandbox.snapshot().hp, 0, "defeat result preserves the player's zero HP for the scene");

for (const asset of [
    "monster-slime.png", "monster-undead.png", "monster-demon.png", "battle-forest-bg.png"
]) {
    const file = path.join(root, "assets/combat", asset);
    assert.ok(fs.existsSync(file), `generated battle asset exists: ${asset}`);
    const signature = fs.readFileSync(file).subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10], `${asset} is a valid PNG`);
}

console.log("✅ Pixel battle scene markup, mobile styling, sprite routing and generated PNG assets passed.");
