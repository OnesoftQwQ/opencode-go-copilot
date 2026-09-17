#!/usr/bin/env node

/**
 * Check for new models available on the API that are not yet hardcoded.
 *
 * Extracts the model IDs of the opencode-go provider from the hardcoded
 * fallback snapshot (src/hardcodedModelList.ts), then compares them against
 * the API model list from /zen/go/v1/models.
 *
 * Outputs JSON result that can be consumed by a GitHub Action.
 *
 * Usage:
 *   node scripts/check-new-models.mjs
 *
 * Exit codes:
 *   0 — no new models found (or API unreachable)
 *   1 — new models found
 */

const API_BASE_URL = "https://opencode.ai/zen/go/v1/";
const HARDCODED_TS_PATH = new URL("../src/hardcodedModelList.ts", import.meta.url);
const PROVIDER_ID = "opencode-go";

// ── Helpers ──

/**
 * Read the provider's model IDs out of the hardcoded snapshot.
 * The snapshot is generated JSON-in-TS, so the object literal between the
 * declaration and the trailing assertion parses as-is.
 */
function extractHardcodedIds(fileContent) {
    const startMarker = "export const HARDCODED_CATALOG: HardcodedCatalogData = {";
    const endMarker = "\n} as unknown as HardcodedCatalogData;";
    const start = fileContent.indexOf(startMarker);
    const end = fileContent.lastIndexOf(endMarker);
    if (start < 0 || end < 0) {
        throw new Error("hardcoded catalog markers not found");
    }
    const data = JSON.parse("{" + fileContent.slice(start + startMarker.length, end) + "\n}");
    return Object.keys(data.providers?.[PROVIDER_ID]?.models ?? {}).sort();
}

async function fetchApiModelIds(apiKey) {
    const url = `${API_BASE_URL.replace(/\/+$/, "")}/models`;
    const response = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) {
        throw new Error(`API error: [${response.status}] ${response.statusText}`);
    }
    const body = await response.json();
    return (body.data ?? []).map((m) => m.id).sort();
}

async function fetchModelsDevEntry(apiModelId) {
    // Try downloading the full catalog for lookup
    const url = "https://models.dev/models.json";
    const response = await fetch(url);
    if (!response.ok) return null;
    const catalog = await response.json();
    // Direct match
    if (catalog[apiModelId]) return catalog[apiModelId];
    // Short ID match (last segment after /)
    for (const [fullId, entry] of Object.entries(catalog)) {
        if (fullId.endsWith(`/${apiModelId}`) || fullId === apiModelId) {
            return entry;
        }
    }
    return null;
}

/**
 * Probe a model to detect if it supports thinking (reasoning) toggling.
 * Sends a minimal request with thinking: { type: "enabled" } and checks the response.
 *
 * @returns "switchable" if thinking is supported, "always" if not, "unknown" if probe failed
 */
async function probeThinkingSupport(apiKey, modelId, apiMode = "openai") {
    if (!apiKey) return "unknown";

    const baseUrl = API_BASE_URL.replace(/\/+$/, "");
    let url, body;

    if (apiMode === "anthropic") {
        // Anthropic format
        url = baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
        body = {
            model: modelId,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
            stream: true,
            thinking: { type: "enabled" },
        };
    } else {
        // OpenAI format (default)
        url = `${baseUrl}/chat/completions`;
        body = {
            model: modelId,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
            stream: true,
            thinking: { type: "enabled" },
        };
    }

    // Abort quickly — we only need the first response
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const headers = apiMode === "anthropic"
            ? { "x-api-key": apiKey, "Content-Type": "application/json", "anthropic-version": "2023-06-01" }
            : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
            // Request accepted — model supports thinking parameter
            // Drain the stream to avoid resource leaks, then return
            const reader = response.body.getReader();
            reader.cancel().catch(() => {});
            return "switchable";
        }

        if (response.status === 400) {
            const text = await response.text().catch(() => "");
            const lowerText = text.toLowerCase();
            // Check if the error mentions thinking/reasoning not being supported
            if (lowerText.includes("thinking") || lowerText.includes("reasoning")) {
                return "always";
            }
            // If model not found or other 400, can't determine
            return "unknown";
        }

        // Other status codes — can't determine
        return "unknown";
    } catch (err) {
        clearTimeout(timeout);
        // Timeout or network error — can't determine
        return "unknown";
    }
}

// ── Main ──

async function main() {
    const args = process.argv.slice(2);
    const apiKeyIndex = args.indexOf("--api-key");
    const apiKey = apiKeyIndex >= 0 ? args[apiKeyIndex + 1] : process.env.OPENCODE_API_KEY;

    // 1. Read hardcoded IDs
    const fs = await import("fs");
    const hardcodedTs = fs.readFileSync(HARDCODED_TS_PATH, "utf-8");

    const hardcodedIds = extractHardcodedIds(hardcodedTs);

    console.error(`[check] Hardcoded ${PROVIDER_ID} models: ${hardcodedIds.length} IDs`);

    // 2. Fetch API model list (no authentication required for model listing)
    let apiModelIds = [];
    let fetchSuccessful = false;
    try {
        apiModelIds = await fetchApiModelIds(apiKey);
        fetchSuccessful = true;
        console.error(`[check] API models: ${apiModelIds.length} IDs`);
    } catch (err) {
        console.error(`[check] Failed to fetch API model list: ${err.message}`);
    }

    // 3. Compare
    const result = {
        fetchSuccessful,
        apiModelIds,
        hardcodedIds,
        newModelIds: [],
        newModelDetails: [],
        summary: "",
    };

    if (fetchSuccessful && apiModelIds.length > 0) {
        const hardcodedSet = new Set(hardcodedIds);
        result.newModelIds = apiModelIds.filter((id) => !hardcodedSet.has(id));

        if (result.newModelIds.length > 0) {
            // Fetch details from models.dev for each new model
            for (const modelId of result.newModelIds.slice(0, 30)) {
                try {
                    const entry = await fetchModelsDevEntry(modelId);
                    if (entry) {
                        // Determine thinking mode from models.dev reasoning field
                        let thinkingMode;
                        if (entry.reasoning === true) {
                            thinkingMode = "switchable";
                        } else if (entry.reasoning === false) {
                            thinkingMode = "always";
                        } else {
                            thinkingMode = "unknown";
                        }

                        result.newModelDetails.push({
                            id: modelId,
                            name: entry.name ?? modelId,
                            context: entry.limit?.context,
                            output: entry.limit?.output,
                            vision: entry.attachment === true || (entry.modalities?.input ?? []).includes("image"),
                            reasoning: entry.reasoning,
                            tool_call: entry.tool_call,
                            detectedThinkingMode: thinkingMode,
                        });
                    } else {
                        result.newModelDetails.push({ id: modelId, detectedThinkingMode: "unknown" });
                    }
                } catch {
                    result.newModelDetails.push({ id: modelId, detectedThinkingMode: "unknown" });
                }
            }

            // Probe thinking support via API if API key is available
            // This verifies/corrects the models.dev inference
            if (apiKey && result.newModelDetails.length > 0) {
                console.error(`[check] Probing thinking support for ${result.newModelDetails.length} model(s)...`);
                for (const detail of result.newModelDetails) {
                    // Skip probing if models.dev already says no thinking
                    if (detail.detectedThinkingMode === "always") {
                        continue;
                    }
                    console.error(`[check]   probing: ${detail.id}...`);
                    const probed = await probeThinkingSupport(apiKey, detail.id);
                    if (probed !== "unknown") {
                        detail.detectedThinkingMode = probed;
                        detail.thinkingProbed = true;
                    }
                    console.error(`[check]     → ${probed}`);
                }
            }

            result.summary = `Found ${result.newModelIds.length} new model(s) on API not yet in hardcoded list.`;
            console.error(`[check] ${result.summary}`);
            for (const m of result.newModelIds) {
                console.error(`[check]   - ${m}`);
            }
        } else {
            result.summary = "All API models are covered by the hardcoded list.";
            console.error(`[check] ${result.summary}`);
        }
    } else {
        result.summary = "API fetch failed or skipped — cannot compare.";
        console.error(`[check] ${result.summary}`);
    }

    // 4. Output JSON for GitHub Action consumption
    console.log(JSON.stringify(result));

    // Exit code: 1 if new models found, 0 otherwise
    if (result.newModelIds.length > 0) {
        process.exit(1);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    // Output empty result on error so the action can handle it gracefully
    console.log(JSON.stringify({
        fetchSuccessful: false,
        apiModelIds: [],
        hardcodedIds: [],
        newModelIds: [],
        newModelDetails: [],
        summary: `Script error: ${err.message}`,
    }));
    process.exit(0);
});
