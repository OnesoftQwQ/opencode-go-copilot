import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation } from "vscode";

import { logger } from "./logger";
import { getBuiltInModelInfos } from "./models";

const EXTENSION_LABEL = "OpenCodeGo";

/**
 * Get the list of available language models contributed by this provider.
 */
export async function prepareLanguageModelChatInformation(
    options: { silent: boolean },
    _token: CancellationToken,
    _secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
    // Use built-in hardcoded model list
    const infos = getBuiltInModelInfos();

    logger.info("models.loaded", { count: infos.length, source: "builtin" });
    return infos;
}
