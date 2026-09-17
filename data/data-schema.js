// ==========================================================================
// data/data-schema.js
// 安全重構第一階段：靜態資料庫兼容 schema helper
// 不改寫既有資料內容，只提供穩定 ID / 顯示名稱清理 / 最小驗證。
// ==========================================================================
(function (global) {
    const EMOJI_AND_SYMBOLS_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;

    function getStaticDatabaseRefs() {
        return {
            CRAFTING_BLUEPRINTS: typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS : null,
            REGULAR_MONSTERS_POOL: typeof REGULAR_MONSTERS_POOL !== "undefined" ? REGULAR_MONSTERS_POOL : null,
            BOSS_DATABASE: typeof BOSS_DATABASE !== "undefined" ? BOSS_DATABASE : null,
            JOB_DATABASE: typeof JOB_DATABASE !== "undefined" ? JOB_DATABASE : null,
            ENVIRONMENT_DATABASE: typeof ENVIRONMENT_DATABASE !== "undefined" ? ENVIRONMENT_DATABASE : null,
            CHEST_TIERS_CONFIG: typeof CHEST_TIERS_CONFIG !== "undefined" ? CHEST_TIERS_CONFIG : null
        };
    }

    function cleanDisplayName(name) {
        if (!name) return "";
        return String(name)
            .replace(EMOJI_AND_SYMBOLS_REGEX, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function slugifyStableValue(value) {
        return String(value || "")
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
            .replace(/^-+|-+$/g, "");
    }

    function getStableId(item, fallbackPrefix = "record", index = 0) {
        const preferredValue = item && typeof item === "object"
            ? item.id || item.stableId || item.key || item.code || item.name || item.displayName
            : item;

        const cleaned = cleanDisplayName(preferredValue);
        const slug = slugifyStableValue(cleaned || preferredValue);
        return slug || `${fallbackPrefix}-${index}`;
    }

    function clonePlainObject(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
    }

    function normalizeItemRecord(item, fallbackPrefix = "item", index = 0) {
        const raw = item && typeof item === "object" ? item : {};
        const displayName = raw.name || raw.displayName || raw.title || `${fallbackPrefix}-${index}`;
        return {
            id: getStableId(raw, fallbackPrefix, index),
            legacyKey: raw.name || raw.id || `${fallbackPrefix}-${index}`,
            displayName,
            cleanName: cleanDisplayName(displayName),
            type: raw.type || "unknown",
            range: raw.range || null,
            stats: clonePlainObject(raw.stats),
            ingredients: clonePlainObject(raw.ingredients),
            desc: typeof raw.desc === "string" ? raw.desc : ""
        };
    }

    function normalizeMonsterRecord(monster, fallbackPrefix = "monster", index = 0) {
        const raw = monster && typeof monster === "object" ? monster : {};
        const displayName = raw.name || raw.displayName || raw.title || `${fallbackPrefix}-${index}`;
        return {
            id: getStableId(raw, fallbackPrefix, index),
            legacyKey: raw.name || raw.id || `${fallbackPrefix}-${index}`,
            displayName,
            cleanName: cleanDisplayName(displayName),
            minFloor: Number.isFinite(Number(raw.minFloor)) ? Number(raw.minFloor) : null,
            maxFloor: Number.isFinite(Number(raw.maxFloor)) ? Number(raw.maxFloor) : null,
            dropItem: raw.dropItem || null,
            stats: {
                baseHp: Number(raw.baseHp) || 0,
                baseAtk: Number(raw.baseAtk) || 0,
                baseDef: Number(raw.baseDef) || Number(raw.def) || 0,
                baseMdef: Number(raw.baseMdef) || Number(raw.mdef) || 0,
                baseSpd: Number(raw.baseSpd) || Number(raw.spd) || 0,
                flee: Number(raw.flee) || 0
            },
            desc: typeof raw.desc === "string" ? raw.desc : ""
        };
    }

    function validateStaticDatabase() {
        const db = getStaticDatabaseRefs();
        const errors = [];

        if (!Array.isArray(db.CRAFTING_BLUEPRINTS)) {
            errors.push("CRAFTING_BLUEPRINTS 缺失或不是陣列。");
        } else {
            db.CRAFTING_BLUEPRINTS.forEach((item, index) => {
                const normalized = normalizeItemRecord(item, "item", index);
                if (!normalized.displayName) {
                    errors.push(`CRAFTING_BLUEPRINTS[${index}] 缺少 name。`);
                }
                if (!normalized.id) {
                    errors.push(`CRAFTING_BLUEPRINTS[${index}] 無法產生 stable id。`);
                }
            });
        }

        if (!Array.isArray(db.REGULAR_MONSTERS_POOL)) {
            errors.push("REGULAR_MONSTERS_POOL 缺失或不是陣列。");
        } else {
            db.REGULAR_MONSTERS_POOL.forEach((monster, index) => {
                const normalized = normalizeMonsterRecord(monster, "monster", index);
                if (!normalized.displayName) {
                    errors.push(`REGULAR_MONSTERS_POOL[${index}] 缺少 name。`);
                }
                if (normalized.minFloor !== null && normalized.maxFloor !== null && normalized.minFloor > normalized.maxFloor) {
                    errors.push(`REGULAR_MONSTERS_POOL[${index}] minFloor 大於 maxFloor。`);
                }
            });
        }

        if (!db.BOSS_DATABASE || typeof db.BOSS_DATABASE !== "object") {
            errors.push("BOSS_DATABASE 缺失或不是物件。");
        }

        if (!db.JOB_DATABASE || typeof db.JOB_DATABASE !== "object") {
            errors.push("JOB_DATABASE 缺失或不是物件。");
        }

        if (!db.ENVIRONMENT_DATABASE || typeof db.ENVIRONMENT_DATABASE !== "object") {
            errors.push("ENVIRONMENT_DATABASE 缺失或不是物件。");
        }

        if (!db.CHEST_TIERS_CONFIG || typeof db.CHEST_TIERS_CONFIG !== "object") {
            errors.push("CHEST_TIERS_CONFIG 缺失或不是物件。");
        }

        if (errors.length > 0) {
            console.groupCollapsed("⚠️ Static database validation errors");
            errors.forEach((message) => console.error(message));
            console.groupEnd();
        } else {
            console.info("✅ Static database validation passed.");
        }

        return {
            ok: errors.length === 0,
            errors
        };
    }

    global.cleanDisplayName = cleanDisplayName;
    global.getStableId = getStableId;
    global.normalizeItemRecord = normalizeItemRecord;
    global.normalizeMonsterRecord = normalizeMonsterRecord;
    global.validateStaticDatabase = validateStaticDatabase;

    if (typeof document !== "undefined") {
        const runValidation = () => {
            try {
                validateStaticDatabase();
            } catch (error) {
                console.error("Static database validation failed unexpectedly:", error);
            }
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", runValidation, { once: true });
        } else {
            runValidation();
        }
    }
})(typeof window !== "undefined" ? window : globalThis);
