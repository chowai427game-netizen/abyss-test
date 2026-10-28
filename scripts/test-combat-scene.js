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
const game = fs.readFileSync(path.join(root, "js/game.js"), "utf8");

for (const id of [
    "battle-scene-box", "battle-monster-vfx-anchor", "battle-attack-swipe", "battle-monster-sprite", "battle-monster-fallback",
    "battle-player-hp-bar", "battle-player-mp-bar", "battle-monster-hp-bar",
    "battle-skill-cooldowns",
    "battle-player-atb-text", "battle-player-atb-bar", "battle-monster-atb-text", "battle-monster-atb-bar",
    "battle-scene-log-line-1", "battle-scene-log-line-2", "battle-item-queue-status", "battle-skill-cast-cue",
    "battle-monster-inspect-card", "battle-monster-inspect-name", "battle-monster-inspect-hp", "battle-monster-inspect-atk",
    "battle-command-panel", "battle-command-categories", "battle-command-options", "battle-command-back",
    "semi-command-controls", "semi-command-options", "semi-command-status"
]) {
    assert.match(html, new RegExp(`id="${id}"`), `battle scene HTML includes #${id}`);
}
assert.match(html, /css\/12-combat-scene\.css/, "battle scene stylesheet is loaded");
assert.match(css, /@media \(max-width: 600px\)/, "battle scene has a mobile layout");
assert.match(css, /prefers-reduced-motion/, "battle scene respects reduced motion preferences");
assert.match(css, /@keyframes first-person-attack/, "first-person slash has an animation");
assert.match(css, /@keyframes diary-caret/, "battle diary has a typewriter cursor animation");
assert.match(css, /body\.battle-scene-cinematic-active::before/, "encounter transition dims the page behind the floating scene");
assert.match(css, /@keyframes battle-scene-encounter-enter/, "encounter scene animates into the center");
assert.match(css, /@keyframes battle-scene-encounter-return/, "battle result scene animates back to its origin");
assert.match(css, /@keyframes battle-backdrop-enter/, "cinematic backdrop fades in smoothly");
assert.match(css, /@keyframes battle-backdrop-return/, "cinematic backdrop fades out smoothly");
assert.match(css, /@keyframes battle-skill-cast-cue/, "skill casting has a dedicated battle animation");
assert.match(ui, /function playBattleSceneEncounterIntro\(\)/, "encounter intro preserves the original layout before moving the scene");
assert.match(ui, /function returnBattleSceneAfterResult\(delay = 2000\)/, "the floating scene waits two seconds after the result before returning");
assert.match(ui, /returnBattleSceneAfterResult\(2000\)/, "both victory and defeat journal results schedule the two-second return");
assert.match(game, /playBattleSceneEncounterIntro\(\)[\s\S]*?startCombatTicker\(\);/, "ATB starts only after the encounter intro transition");
assert.match(css, /\.battle-meter span\s*\{[\s\S]*?transition: width \.25s linear;/, "ATB bars interpolate continuously instead of stepping");
assert.match(ui, /getSkillCooldownRemaining\(skillMeta\)/, "the battle HUD displays live remaining cooldown seconds");
assert.match(html, /tactic-btn-MANUAL[\s\S]*?手動指令[\s\S]*?選擇戰鬥、技能或道具/, "manual mode presents selectable player commands");
assert.match(html, /tactic-btn-SEMI[\s\S]*?半自動/, "semi-auto mode has its own tactic control");
assert.match(game, /manualTurnPaused = true;[\s\S]*?refreshCombatPauseState\(\);/, "a full player ATB pauses the battle for manual input");
assert.match(game, /function queueSemiCombatCommand\(/, "semi-auto exposes a next-turn action queue");
assert.match(game, /tickSkillCooldowns\(0\.25\)/, "skill cooldowns advance on active combat ticks");
assert.match(css, /\.battle-command-panel\s*\{/, "manual battle commands have a dedicated scene panel");
assert.match(css, /\.battle-command-panel\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?bottom:\s*39px;[\s\S]*?left:\s*10px;/, "manual commands are anchored in the lower-left battle scene");
assert.match(css, /\.battle-command-actions, \.battle-command-options\s*\{[\s\S]*?flex-direction:\s*column;/, "manual categories, skills and items are selected top-to-bottom");
assert.match(css, /\.battle-command-options button\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?min-height:\s*25px;/, "skill and item options are compact rows rather than oversized cards");
assert.match(css, /\.battle-command-option\[data-tooltip\]::after/, "skill buttons render a dedicated detailed tooltip");
assert.match(css, /\.battle-monster-inspect-card\s*\{/, "battle scene includes a monster hover information card");
assert.match(css, /#battle-scene-box:has\(#battle-monster-sprite:hover\) \.battle-monster-inspect-card/, "hovering the monster reveals the information card");
assert.match(css, /--battle-enemy-ground:\s*clamp\(/, "enemy, ground shadow and VFX share a responsive foreground anchor");
assert.match(css, /\.battle-scene\s*\{[\s\S]*?--battle-enemy-ground:\s*clamp\(18px, 7%, 46px\)/, "grounded monsters share the corrected lower ground baseline");
assert.match(css, /\.battle-sprite\s*\{[\s\S]*?height:\s*var\(--battle-monster-desktop-height, 168px\);[\s\S]*?bottom:\s*calc\(var\(--battle-enemy-ground\) \+ var\(--battle-monster-desktop-lift, 0px\)\);[\s\S]*?object-position:\s*center bottom;/, "monster height and lift are driven by individual presentation settings");
assert.match(css, /\.battle-enemy-sprite\.battle-boss-sprite\s*\{\s*height:\s*218px;\s*max-width:\s*72%;\s*\}/, "bosses remain larger than regular monsters");
assert.match(css, /@media \(max-width: 600px\)[\s\S]*?--battle-enemy-ground:\s*clamp\(16px, 7%, 34px\)[\s\S]*?\.battle-sprite\s*\{\s*height:\s*var\(--battle-monster-mobile-height, 142px\);\s*max-width:\s*92%;\s*bottom:\s*calc\(var\(--battle-enemy-ground\) \+ var\(--battle-monster-mobile-lift, 0px\)\);\s*\}/, "mobile monster position and size remain responsive");
assert.match(css, /\.battle-scene\.is-floating-monster \.battle-enemy-sprite:not\(\.is-hit\):not\(\.is-critical\)[\s\S]*?animation:\s*battle-monster-hover/, "floating monsters bob without conflicting with hit reactions");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.battle-scene\.is-floating-monster \.battle-enemy-sprite:not\(\.is-hit\):not\(\.is-critical\)[\s\S]*?animation-duration:\s*1ms/, "floating animation respects reduced-motion preference");
assert.match(css, /\.battle-monster-vfx-anchor\s*\{[\s\S]*?bottom:\s*calc\(var\(--battle-enemy-ground\) \+ var\(--battle-monster-vfx-lift, 20px\)\)/, "hit VFX can align with individually elevated monsters");
assert.match(ui, /"🐗 荒野半獸人": \{ desktopHeight: 220, mobileHeight: 188 \}/, "the wild orc is configured as a large monster");
assert.match(ui, /"🧱 古墓巨石守衛": \{ desktopHeight: 228, mobileHeight: 194 \}/, "the stone guardian is configured as the largest regular monster");
assert.match(ui, /"👻 迷途哭泣怨靈": \{[^\n]*desktopLift: 58, mobileLift: 42[^\n]*floating: true \}/, "the wraith is raised above the ground and floats");
assert.match(ui, /function applyBattleMonsterLayout\(scene, monster\)/, "monster-specific size and position are applied to the battle scene");
const monsterLayoutMatch = ui.match(/const BATTLE_MONSTER_LAYOUT_OVERRIDES = Object\.freeze\((\{[\s\S]*?\n\})\);/);
assert.ok(monsterLayoutMatch, "monster layout overrides are available for validation");
const monsterLayoutOverrides = vm.runInNewContext(`(${monsterLayoutMatch[1]})`);
assert.ok(monsterLayoutOverrides["🐗 荒野半獸人"].desktopHeight > monsterLayoutOverrides["👺 綠皮哥布林"].desktopHeight, "the orc is larger than the goblin");
assert.ok(monsterLayoutOverrides["🧱 古墓巨石守衛"].desktopHeight > monsterLayoutOverrides["🐗 荒野半獸人"].desktopHeight, "the stone guardian is larger than the orc");
assert.ok(monsterLayoutOverrides["🥩 煉獄虐殺食人魔"].desktopHeight > monsterLayoutOverrides["💀 焦黑地獄刺客"].desktopHeight, "the infernal ogre is larger than the assassin");
assert.ok(new Set(Object.values(monsterLayoutOverrides).map((layout) => layout.desktopHeight)).size >= 10, "regular monster sizes are individually varied");
assert.ok(monsterLayoutOverrides["👻 迷途哭泣怨靈"].desktopLift > 0 && monsterLayoutOverrides["👻 迷途哭泣怨靈"].floating, "the wraith has a raised floating position");
assert.ok(monsterLayoutOverrides["🔮 浮空禁忌魔導書"].desktopLift > 0 && monsterLayoutOverrides["🔮 浮空禁忌魔導書"].floating, "the forbidden grimoire has a raised floating position");
assert.ok(monsterLayoutOverrides["👁️ 虛空扭曲觀察者"].desktopLift > 0 && monsterLayoutOverrides["👁️ 虛空扭曲觀察者"].floating, "the void observer has a raised floating position");
assert.ok(monsterLayoutOverrides["🗿 虛空遺蹟守衛像"].desktopHeight > monsterLayoutOverrides["🌌 裂縫黯夜潛行者"].desktopHeight, "the void ruins sentinel is larger than the stalker");
assert.ok(monsterLayoutOverrides["🌌 裂縫黯夜潛行者"].floating && monsterLayoutOverrides["🦇 異次元吸血巨蝠"].floating, "the rift stalker and vampire bat float");
assert.match(css, /\.battle-scene\.is-poison-zone\s*\{[\s\S]*?battle-poison-bg\.png/, "poison battles use the dedicated toxic dungeon background");
assert.match(css, /\.battle-scene\.is-ice-zone\s*\{[\s\S]*?battle-ice-bg\.png/, "ice battles use the dedicated frozen dungeon background");
assert.match(css, /\.battle-scene\.is-fire-zone\s*\{[\s\S]*?battle-fire-bg\.png/, "fire battles use the dedicated magma dungeon background");
assert.equal((html.match(/id="tactics-drawer-box"/g) || []).length, 1, "only one tactics drawer remains");
const sceneStart = html.indexOf('id="battle-scene-box"');
const sceneEnd = html.indexOf("</section>", sceneStart);
const drawerPosition = html.indexOf('id="tactics-drawer-box"');
assert.ok(sceneStart >= 0 && drawerPosition > sceneStart && drawerPosition < sceneEnd, "tactics drawer is nested in the battle scene");
const commandPosition = html.indexOf('id="battle-command-panel"');
assert.ok(commandPosition > sceneStart && commandPosition < sceneEnd, "manual commands are nested in the battle scene so they move with it");
const diaryStart = html.indexOf('id="log-wrapper-box"');
const diaryEnd = html.indexOf("</section>", diaryStart);
assert.ok(diaryStart >= 0 && (html.indexOf('id="tactics-drawer-box"') < diaryStart || html.indexOf('id="tactics-drawer-box"') > diaryEnd), "the diary column no longer owns the tactics drawer");
assert.match(ui, /new Intl\.Segmenter\("zh-Hant", \{ granularity: "grapheme" \}\)/, "typewriter reveals Chinese characters by grapheme");
assert.doesNotMatch(ui, /battle-player-sprite/, "the player sprite is removed from UI element caching");
assert.doesNotMatch(html, /battle-player-sprite|hero-knight\.png|battle-versus/, "battle stage displays no player character or versus marker");
assert.match(html, /最近兩則戰鬥日記/, "scene shows recent battle diary entries");
assert.match(ui, /function syncBattleSceneLog\(message, logType = "deal"\)/, "diary entries are synchronized with their log type");
assert.match(ui, /function getBattleDiaryTone\(text, logType = "deal"\)/, "diary entries receive combat-state colors");
assert.match(ui, /Your Turn\.\./, "manual turn title uses the requested Your Turn.. label");
assert.match(ui, /button\.dataset\.tooltip = title/, "skill command descriptions are exposed to the tooltip layer");
assert.match(ui, /function showBattleSkillCastCue\(/, "battle UI exposes a dedicated skill cast cue");
assert.match(ui, /function closeManualBattleCommandList\(\)/, "manual command list uses one fixed return action instead of appending duplicates");
assert.match(ui, /function updateBattleMonsterInspectCard\(monster\)/, "monster hover information is synchronized from active battle data");
const monsterPortraitManifest = JSON.parse(fs.readFileSync(path.join(root, "assets/combat/monsters/manifest.json"), "utf8"));
assert.equal(monsterPortraitManifest.completedCount, 20, "twenty monster portraits are complete");
for (const [monsterName, assetPath] of Object.entries({
    "💧 藍色史萊姆": "assets/combat/monsters/regular-01-blue-slime.png",
    "👺 綠皮哥布林": "assets/combat/monsters/regular-02-green-goblin.png",
    "🐗 荒野半獸人": "assets/combat/monsters/regular-03-wild-orc.png",
    "👻 迷途哭泣怨靈": "assets/combat/monsters/regular-04-lost-wailing-wraith.png",
    "🧱 古墓巨石守衛": "assets/combat/monsters/regular-05-ancient-tomb-stone-guardian.png",
    "❄️ 冰川小惡魔": "assets/combat/monsters/regular-06-glacier-little-demon.png",
    "🕷️ 地底毒牙蛛": "assets/combat/monsters/regular-07-underground-venomfang-spider.png",
    "🧟 復甦凍僵腐屍": "assets/combat/monsters/regular-08-revived-frozen-corpse.png",
    "🦅 冰原吸血皮翼": "assets/combat/monsters/regular-09-icefield-vampire-wing.png",
    "🛡️ 鋼鐵霜殼陸龜": "assets/combat/monsters/regular-10-steel-frostshell-tortoise.png",
    "🔥 焦土爆烈小鬼": "assets/combat/monsters/regular-11-scorched-earth-explosive-imp.png",
    "🦎 熔岩劇毒壁虎": "assets/combat/monsters/regular-12-lava-toxic-gecko.png",
    "💀 焦黑地獄刺客": "assets/combat/monsters/regular-13-charred-hell-assassin.png",
    "🥩 煉獄虐殺食人魔": "assets/combat/monsters/regular-14-infernal-butcher-ogre.png",
    "🔮 浮空禁忌魔導書": "assets/combat/monsters/regular-15-floating-forbidden-grimoire.png",
    "👁️ 虛空扭曲觀察者": "assets/combat/monsters/regular-16-void-twisted-observer.png",
    "🌌 裂縫黯夜潛行者": "assets/combat/monsters/regular-17-rift-nocturnal-stalker.png",
    "🦇 異次元吸血巨蝠": "assets/combat/monsters/regular-18-interdimensional-vampire-bat.png",
    "🗿 虛空遺蹟守衛像": "assets/combat/monsters/regular-19-void-ruins-sentinel.png",
    "🐍 劇毒多頭利維坦": "assets/combat/monsters/regular-20-toxic-many-headed-leviathan.png"
})) {
    assert.ok(ui.includes(`"${monsterName}": "${assetPath}"`), `${monsterName} has a dedicated battle portrait mapping`);
    assert.ok(fs.existsSync(path.join(root, assetPath)), `${assetPath} exists`);
}
assert.match(ui, /hideFloatingCard\(\);/, "inventory and village transitions clear stale floating item cards");
assert.match(ui, /\["NORMAL", "VOID", "ICE", "FIRE", "POISON"\]\.forEach/, "battle scene maps every environment type to a matching background class");
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
assert.match(game, /firstPersonAttack: true, result: damageResult\.isCrit \? "crit" : "hit"/, "basic attacks and skills feed first-person combat feedback");
assert.match(game, /showBattleSkillCastCue\(skillName, fxClass, effect\)/, "active skills trigger the dedicated battle cast cue");
assert.match(ui, /updateBattleScene\(typeof activeMonster/, "regular UI updates sync the scene before state-specific early returns");
assert.match(game, /portraitName: fallbackMonster\.portraitName \|\| fallbackMonster\.name/, "elite monsters preserve the original portrait name");
assert.match(ui, /scene\.classList\.toggle\('is-elite-battle', Boolean\(displayedMonster\.isElite\)\)/, "elite battle styling follows the elite state");
assert.match(css, /\.battle-scene\.is-elite-battle \.battle-hud-enemy::before/, "elite monsters have a dedicated HUD badge");
assert.match(css, /\.battle-scene\.is-elite-battle \.battle-enemy-sprite,[\s\S]*?drop-shadow\(0 0 5px/, "elite portraits receive a warm visual glow");

const portraitHelpers = ui.match(/const BATTLE_MONSTER_PORTRAIT_OVERRIDES = Object\.freeze\(\{[\s\S]*?(?=\nfunction setBattleMeter)/);
assert.ok(portraitHelpers, "monster portrait lookup helpers exist");
const spriteSandbox = {};
vm.runInNewContext(`${portraitHelpers[0]}; this.portraitName = getBattleMonsterPortraitName; this.classify = getBattleMonsterSpriteVariant; this.portraitPath = getBattleMonsterPortraitPath;`, spriteSandbox);
assert.equal(spriteSandbox.classify({ name: "💧 藍色史萊姆" }), "slime");
assert.equal(spriteSandbox.classify({ name: "👻 迷途哭泣怨靈" }), "undead");
assert.equal(spriteSandbox.classify({ name: "🔥 煉獄魔神", isBoss: true }), "demon");
assert.equal(spriteSandbox.classify({ name: "👑 虛空領主", isBoss: true }), "", "non-demon bosses keep their existing icon");
assert.equal(spriteSandbox.classify({ name: "👺 綠皮哥布林" }), "", "unmatched enemies use their existing icon fallback");
assert.equal(spriteSandbox.portraitName({ name: "💀 精英・🧱 古墓巨石守衛" }), "🧱 古墓巨石守衛");
assert.equal(spriteSandbox.portraitPath({ name: "💀 精英・🧱 古墓巨石守衛", isElite: true, portraitName: "🧱 古墓巨石守衛" }), "assets/combat/monsters/regular-05-ancient-tomb-stone-guardian.png", "elite monsters reuse the original dedicated portrait");
assert.equal(spriteSandbox.portraitPath({ name: "💀 精英・🧱 古墓巨石守衛", isElite: true }), "assets/combat/monsters/regular-05-ancient-tomb-stone-guardian.png", "legacy elite records without portraitName resolve from their display name");
assert.equal(spriteSandbox.portraitPath({ name: "💀 精英・👻 迷途哭泣怨靈", isElite: true }), "assets/combat/monsters/regular-04-lost-wailing-wraith.png", "elite variants prefer their original dedicated portrait");

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
function restoreBattleSceneAfterEncounterIntro() {}
function returnBattleSceneAfterResult() { return true; }
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
    "monster-slime.png", "monster-undead.png", "monster-demon.png", "battle-forest-bg.png",
    "battle-ruins-bg.png", "battle-void-bg.png", "battle-ice-bg.png", "battle-fire-bg.png", "battle-poison-bg.png"
]) {
    const file = path.join(root, "assets/combat", asset);
    assert.ok(fs.existsSync(file), `generated battle asset exists: ${asset}`);
    const signature = fs.readFileSync(file).subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10], `${asset} is a valid PNG`);
}

console.log("✅ Pixel battle scene, manual/semi-auto commands, combat-time cooldowns, mobile styling and generated PNG assets passed.");
