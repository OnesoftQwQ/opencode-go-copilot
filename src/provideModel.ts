import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation, PrepareLanguageModelChatModelOptions } from "vscode";

import { logger } from "./logger";
import { getApiModelIds, clearApiModelCache } from "./apiModelList";
import { ensureModelsDevLoaded, clearModelsDevCache, getCatalogProviderModelIds } from "./modelsDev";
import { buildCatalogModelInfo } from "./catalogModels";
import { delay } from "./utils";

const GO_PROVIDER_ID = "opencode-go";
const ZEN_PROVIDER_ID = "opencode";

let isUpdatingModelsDev = false;
let lastModelsDevUpdate = 0;
let cachedDiscoveredInfos: LanguageModelChatInformation[] | null = null;

let cachedZenInfos: LanguageModelChatInformation[] | null = null;
let lastZenUpdate = 0;

/**
 * Build the full OpenCode Go model list from the catalog.
 * When the API model list is available, models the server does not serve are
 * filtered out (this also drops stale/dirty IDs the API may return, e.g. ones
 * absent from the catalog). When the API is unreachable, the full catalog list
 * is returned.
 */
async function runCatalogPass(secrets: vscode.SecretStorage): Promise<LanguageModelChatInformation[] | null> {
    // The catalog governs model behaviour (apiMode, thinking, vision, context
    // limits) and the API base URL — it must be loaded first.
    await ensureModelsDevLoaded();

    const catalogIds = getCatalogProviderModelIds(GO_PROVIDER_ID);
    if (catalogIds.length === 0) {
        logger.info("models.discovery", {
            action: "fallback",
            reason: "catalog_empty_or_failed",
        });
        return null;
    }

    // Optionally filter against the actual API model list
    let availableIds = catalogIds;
    const config = vscode.workspace.getConfiguration();
    const enableAutoDiscovery = config.get<boolean>("opencodego.enableAutoModelDiscovery", true);
    if (enableAutoDiscovery) {
        const apiKey = await secrets.get("opencodego.apiKey");
        const apiModelIds = await getApiModelIds(apiKey);
        if (apiModelIds.size > 0) {
            availableIds = catalogIds.filter((id) => apiModelIds.has(id));
        }
    }

    const infos = availableIds.map((id) => buildCatalogModelInfo(GO_PROVIDER_ID, id));

    logger.info("models.discovery", {
        action: "catalog_loaded",
        catalogCount: catalogIds.length,
        availableCount: infos.length,
        ids: infos.map((i) => i.id).join(", "),
    });

    return infos;
}

async function waitForPendingUpdate(token: CancellationToken): Promise<void> {
    while (isUpdatingModelsDev && !token.isCancellationRequested) {
        await delay(200, token);
    }
}

export function resetAutoDiscoveryState(): void {
    isUpdatingModelsDev = false;
    lastModelsDevUpdate = 0;
    cachedDiscoveredInfos = null;
    cachedZenInfos = null;
    lastZenUpdate = 0;
    clearApiModelCache();
    clearModelsDevCache();
    logger.info("models.discovery", {
        action: "reset",
    });
}

/**
 * Fetch the OpenCode Zen free model list from the catalog with interval caching.
 * Only models with IDs ending in "-free" are included.
 */
async function fetchZenFreeModelsCached(
    token: CancellationToken,
    updateInterval: number
): Promise<LanguageModelChatInformation[]> {
    const now = Date.now();
    if (cachedZenInfos && now - lastZenUpdate < updateInterval) {
        return cachedZenInfos;
    }

    if (token.isCancellationRequested) return cachedZenInfos ?? [];

    try {
        await ensureModelsDevLoaded();
        const zenIds = getCatalogProviderModelIds(ZEN_PROVIDER_ID).filter((id) => id.endsWith("-free"));
        const zenInfos = zenIds.map((id) => buildCatalogModelInfo(ZEN_PROVIDER_ID, id));
        cachedZenInfos = zenInfos;
        lastZenUpdate = Date.now();
        if (zenInfos.length > 0) {
            logger.info("models.discovery", {
                action: "zen_free_models_loaded",
                count: zenInfos.length,
                ids: zenInfos.map((info) => info.id).join(", "),
                source: "zen-free",
            });
            logger.info("models.loaded", { count: zenInfos.length, source: "zen-free" });
        }

        return zenInfos;
    } catch (error) {
        logger.error("models.loaded", {
            source: "zen-free",
            error: error instanceof Error ? error.message : String(error),
        });
        return cachedZenInfos ?? [];
    }
}

export async function prepareLanguageModelChatInformation(
    options: PrepareLanguageModelChatModelOptions,
    _token: CancellationToken,
    _secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
    if (_token.isCancellationRequested) {
        return cachedDiscoveredInfos ?? [];
    }

    const config = vscode.workspace.getConfiguration();
    const updateInterval = config.get<number>("opencodego.modelsDevUpdateInterval", 60 * 1000);
    const now = Date.now();

    // ── Catalog Pass ──
    if (isUpdatingModelsDev) {
        await waitForPendingUpdate(_token);
    } else if (now - lastModelsDevUpdate >= updateInterval) {
        isUpdatingModelsDev = true;
        try {
            if (!_token.isCancellationRequested) {
                const discovered = await runCatalogPass(_secrets);
                if (discovered) {
                    cachedDiscoveredInfos = discovered;
                    lastModelsDevUpdate = Date.now();
                }
            }
        } catch (error) {
            logger.error("models.discovery", {
                action: "error",
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            isUpdatingModelsDev = false;
        }
    }

    // ── Assemble Base & Secondary Model Lists ──
    const baseInfos = cachedDiscoveredInfos ? [...cachedDiscoveredInfos] : [];

    const enableZen = config.get<boolean>("opencodego.enableZenFreeModels", false);
    const zenInfos = enableZen ? await fetchZenFreeModelsCached(_token, updateInterval) : [];

    return [...baseInfos, ...zenInfos];
}