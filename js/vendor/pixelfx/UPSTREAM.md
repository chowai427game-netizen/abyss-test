# PixelFX upstream record

This folder vendors the PixelFX code used for combat damage/critical numbers and the encounter Shatter Wipe transition.

- Upstream project: https://github.com/patch-gg/pixelfx
- Upstream version: `0.3.0`
- Upstream revision: `a84159688af3ca37a4be05a0d422b94451b2e24e`
- Damage/critical sources: `src/fx/ui/damage-number.js`, `src/fx/ui/crit-number.js`, and `src/fx/ui/_lib.js`.
- Encounter transition sources: `src/fx/transitions/shatter-wipe.js` and `src/fx/transitions/_lib.js`.
- Required core modules are copied from that revision. `src/core/index.js` is a small local barrel that exports only the symbols used by these effects and transitions; the upstream effect sources and helpers remain otherwise unmodified.
- The PixelFX MIT license and upstream NOTICE are retained beside the sources. Sprite Fusion attribution and MIT notices in the upstream transition files are preserved. The separate Patch Pixel font under upstream `gallery/fonts` is not included.
- Game adapters: `js/pixelfx-combat-number-bridge.js` renders damage/crit numbers; `js/pixelfx-encounter-transition.js` renders the 320×180 encounter wipe at 0.5× with the Smoke palette and nearest-neighbor scaling.
