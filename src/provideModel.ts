import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation, PrepareLanguageModelChatModelOptions } from "vscode";

import { logger } from "./logger";
import { getApiModelIds, clearApiModelCache } from "./apiModelList";
import { ensureModelsDevLoaded, clearModelsDevCache, getCatalogProviderModelIds } from "./modelsDev";
import { buildCatalogModelInfo, isModelDeprecated } from "./catalogModels";
import { delay } from "./utils";

const GO_PROVIDER_ID = "opencode-go";

let isUpdatingModelsDev = false;
let lastModelsDevUpdate = 0;
let cachedDiscoveredInfos: LanguageModelChatInformation[] | null = null;

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

    // Drop deprecated models from the picker unless the user opts in to see them
    const showDeprecated = vscode.workspace.getConfiguration().get<boolean>("opencodego.showDeprecatedModels", false);
    const infos = availableIds
        .filter((id) => showDeprecated || !isModelDeprecated(GO_PROVIDER_ID, id))
        .map((id) => buildCatalogModelInfo(GO_PROVIDER_ID, id));

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
    clearApiModelCache();
    clearModelsDevCache();
    logger.info("models.discovery", {
        action: "reset",
    });
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

    return cachedDiscoveredInfos ? [...cachedDiscoveredInfos] : [];
}