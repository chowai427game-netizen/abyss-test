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
    "battle-player-hp-bar", "battle-player-mp-bar", "battle-monster-hp-bar"
]) {
    assert.match(html, new RegExp(`id="${id}"`), `battle scene HTML includes #${id}`);
}
assert.match(html, /css\/12-combat-scene\.css/, "battle scene stylesheet is loaded");
assert.match(css, /@media \(max-width: 600px\)/, "battle scene has a mobile layout");
assert.match(css, /prefers-reduced-motion/, "battle scene respects reduced motion preferences");
assert.match(css, /@keyframes first-person-attack/, "first-person slash has an animation");
assert.doesNotMatch(ui, /battle-player-sprite/, "the player sprite is removed from UI element caching");
assert.doesNotMatch(html, /battle-player-sprite|hero-knight\.png|battle-versus/, "battle stage displays no player character or versus marker");
assert.match(html, /第一人稱戰鬥/, "scene is labeled as first-person combat");
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

for (const asset of [
    "monster-slime.png", "monster-undead.png", "monster-demon.png", "battle-forest-bg.png"
]) {
    const file = path.join(root, "assets/combat", asset);
    assert.ok(fs.existsSync(file), `generated battle asset exists: ${asset}`);
    const signature = fs.readFileSync(file).subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10], `${asset} is a valid PNG`);
}

console.log("✅ Pixel battle scene markup, mobile styling, sprite routing and generated PNG assets passed.");
