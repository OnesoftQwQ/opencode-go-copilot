/**
 * Refresh the hardcoded catalog snapshot (src/hardcodedModelList.ts).
 *
 * Fetches the official models.dev catalog, extracts the opencode-go and
 * opencode provider sections, and regenerates the snapshot file with full
 * model metadata. Used by the release workflow before compiling so every
 * published VSIX ships a fresh snapshot; the regenerated file is committed
 * together with the version bump when data changed.
 *
 * Non-blocking by design: on fetch failure the existing snapshot is kept and
 * the script exits 0 so the build continues (the snapshot exists precisely
 * for offline scenarios).
 *
 * Run: node scripts/update-hardcoded-catalog.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CATALOG_URL = "https://models.dev/catalog.json";
const PROVIDER_IDS = ["opencode-go", "opencode"];
const OUT_FILE = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "hardcodedModelList.ts"
);

async function fetchCatalog() {
    const response = await fetch(CATALOG_URL, {
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function renderTs(data, date) {
    const header = `/**
 * Hardcoded fallback catalog snapshot.
 *
 * Last-resort fallback when both the official models.dev catalog and the
 * configured mirror are unreachable. Contains the complete provider sections
 * for opencode-go (OpenCode Go) and opencode (OpenCode Zen) exactly as
 * published in the official catalog — full model metadata included
 * (limit, cost, reasoning_options, attachment, modalities, ...), so the
 * fallback behaves like the real catalog instead of a bare ID list.
 *
 * Snapshot taken from the official models.dev catalog on ${date}.
 */

import type { CatalogProvider, ModelsDevEntry } from "./modelsDev";

/**
 * Minimal catalog shape: global models map + provider sections.
 */
export interface HardcodedCatalogData {
    models: Record<string, ModelsDevEntry>;
    providers: Record<string, CatalogProvider>;
}

// Asserted like the runtime catalog JSON: the official snapshot's cost shapes
// vary between entries (some omit cache_read, some add cache_write), which the
// ModelsDevEntry type does not fully model.
export const HARDCODED_CATALOG: HardcodedCatalogData = {
`;
    const body = JSON.stringify(data, null, 2).slice(1, -1);
    const footer = `
} as unknown as HardcodedCatalogData;
`;
    return header + body + footer;
}

async function main() {
    const catalog = await fetchCatalog();
    const providers = {};
    for (const id of PROVIDER_IDS) {
        if (!catalog.providers?.[id]) {
            throw new Error(`provider "${id}" not found in catalog`);
        }
        providers[id] = catalog.providers[id];
    }
    const data = { models: {}, providers };
    const date = new Date().toISOString().slice(0, 10);
    const content = renderTs(data, date);

    const existing = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
    fs.writeFileSync(OUT_FILE, content);
    if (content === existing) {
        console.log("hardcoded catalog: unchanged, nothing to do");
    } else {
        const goCount = Object.keys(providers["opencode-go"].models).length;
        const zenCount = Object.keys(providers["opencode"].models).length;
        console.log(`hardcoded catalog: refreshed (opencode-go ${goCount}, opencode ${zenCount}) -> ${path.relative(process.cwd(), OUT_FILE)}`);
    }
}

main().catch((err) => {
    console.warn(`hardcoded catalog: refresh skipped (${err.message}); keeping existing snapshot`);
    process.exit(0);
});
