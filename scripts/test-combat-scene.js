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
    "battle-scene-log-line-1", "battle-scene-log-line-2"
]) {
    assert.match(html, new RegExp(`id="${id}"`), `battle scene HTML includes #${id}`);
}
assert.match(html, /css\/12-combat-scene\.css/, "battle scene stylesheet is loaded");
assert.match(css, /@media \(max-width: 600px\)/, "battle scene has a mobile layout");
assert.match(css, /prefers-reduced-motion/, "battle scene respects reduced motion preferences");
assert.match(css, /@keyframes first-person-attack/, "first-person slash has an animation");
assert.doesNotMatch(ui, /battle-player-sprite/, "the player sprite is removed from UI element caching");
assert.doesNotMatch(html, /battle-player-sprite|hero-knight\.png|battle-versus/, "battle stage displays no player character or versus marker");
assert.match(html, /最近兩則戰鬥日記/, "scene shows recent battle diary entries");
assert.match(ui, /function syncBattleSceneLog\(message\)/, "diary entries are synchronized to the scene");
assert.match(ui, /發現魔物/, "a new encounter resets the scene diary");
assert.match(ui, /VICTORY!/, "victory text is retained at battle end");
assert.match(ui, /你已被擊敗/, "defeat text is retained at battle end");
assert.match(ui, /battle-player-atb-text/, "player ATB is rendered in the scene HUD");
assert.match(ui, /battle-monster-atb-text/, "monster ATB is rendered in the scene HUD");
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

const logSource = ui.match(/function syncBattleSceneLog\(message\) \{[\s\S]*?\n\}/);
assert.ok(logSource, "two-line scene diary synchronizer exists");
const diaryElements = { "battle-scene-log-line-1": { textContent: "" }, "battle-scene-log-line-2": { textContent: "" } };
const diarySandbox = {
    Date,
    setTimeout: () => 1,
    clearTimeout: () => {},
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
function renderBattleSceneLog() {
    diaryElements["battle-scene-log-line-1"].textContent = battleSceneLogLines[0] || "發現魔物";
    diaryElements["battle-scene-log-line-2"].textContent = battleSceneLogLines[1] || "戰鬥開始！";
}
${logSource[0]}
this.getLines = () => battleSceneLogLines;
this.syncDiary = syncBattleSceneLog;
this.snapshot = () => battleSceneTerminalSnapshot;`, diarySandbox);
diarySandbox.syncDiary("發現魔物：藍色史萊姆");
diarySandbox.syncDiary("勇者普通攻擊造成 8 傷害");
diarySandbox.syncDiary("史萊姆反擊造成 3 傷害");
assert.deepEqual(Array.from(diarySandbox.getLines()), ["勇者普通攻擊造成 8 傷害", "史萊姆反擊造成 3 傷害"]);
diarySandbox.syncDiary("討伐成功！ VICTORY! 獲得金幣 🪙 +28 G，經驗值 +25。");
assert.match(diarySandbox.getLines()[1], /VICTORY!/);
assert.equal(diarySandbox.snapshot().monster.name, "💧 藍色史萊姆");
diarySandbox.activeMonster = { name: "👹 深淵魔物", hp: 55, maxHp: 80 };
diarySandbox.currentRun.hp = 0;
diarySandbox.syncDiary("發現魔物：深淵魔物");
diarySandbox.syncDiary("你已被擊敗！損失經驗值並返回村莊。");
assert.match(diarySandbox.getLines()[1], /你已被擊敗/);
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
