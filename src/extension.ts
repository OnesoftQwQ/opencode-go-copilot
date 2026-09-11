import * as vscode from "vscode";
import { OpenCodeGoChatModelProvider } from "./provider";
import { initStatusBar, refreshGoUsageNow } from "./statusBar";
import { formatUsageSummary, getUsageFetchStatus } from "./goUsage";
import { logger } from "./logger";
import { l10n, l10nFormat } from "./localize";
import type { ModelPreset } from "./types";
import { VersionManager } from "./versionManager";
import { abortCommitGeneration, generateCommitMsg } from "./gitCommit/commitMessageGenerator";
import { TokenizerManager } from "./tokenizer/tokenizerManager";
import { prepareLanguageModelChatInformation, resetAutoDiscoveryState } from "./provideModel";
import { initSessionRouting, resetSessionRouting } from "./sessionRouting";
import { validateBaseUrl } from "./utils";

// ---- Walkthrough / Welcome constants ----

/** memento key tracking whether the welcome walkthrough has been shown. */
const WELCOME_SHOWN_KEY = "opencodego.welcomeShown";

/** Walkthrough contribution ID (publisher.extension#walkthroughId). */
const WALKTHROUGH_ID = "OnesoftQwQ.opencode-go-copilot-provider#opencodeGoGettingStarted";

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    logger.init();
    logger.info("extension.activate", { version: VersionManager.getVersion() });

    // Initialize TokenizerManager with extension path
    TokenizerManager.initialize(context.extensionPath);

    const tokenCountStatusBarItem: vscode.StatusBarItem = initStatusBar(context, context.secrets);
    const provider = new OpenCodeGoChatModelProvider(context.secrets, tokenCountStatusBarItem);

    // Restore the persisted session ID registry (3-day TTL) before any
    // request can resolve a session ID.
    initSessionRouting(context.globalState);

    // Register the OpenCode Go provider under the vendor id used in package.json
    vscode.lm.registerLanguageModelChatProvider("opencodego", provider);

    // Management command to configure API key
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.setApiKey", async () => {
            const existing = await context.secrets.get("opencodego.apiKey");
            const apiKey = await vscode.window.showInputBox({
                title: l10n("OpenCode Go Provider API Key"),
                prompt: existing ? l10n("Update your OpenCode Go API key") : l10n("Enter your OpenCode Go API key"),
                ignoreFocusOut: true,
                password: true,
                value: existing ?? "",
            });
            if (apiKey === undefined) {
                return; // user canceled
            }
            if (!apiKey.trim()) {
                await context.secrets.delete("opencodego.apiKey");
                vscode.window.showInformationMessage(l10n("OpenCode Go API key cleared."));
                return;
            }
            await context.secrets.store("opencodego.apiKey", apiKey.trim());
            vscode.window.showInformationMessage(l10n("OpenCode Go API key saved."));
        })
    );

    // manually trigger model list update command
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.updateModelList", async () => {
            try {
                // dummy silent option, not used
                resetAutoDiscoveryState();
                await prepareLanguageModelChatInformation({ silent: true }, new vscode.CancellationTokenSource().token, context.secrets);
                vscode.window.showInformationMessage(l10n("OpenCode Go model list updated successfully."));
            } catch (error) {
                logger.error("models.update.failed", { error: String(error) });
                vscode.window.showErrorMessage(l10n("Failed to update OpenCode Go model list. See output for details."));
            }
        })
    );

    // Command to check / refresh the OpenCode Go plan usage.
    // Also bound to clicking the status bar item (see statusBar.ts).
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.checkUsage", async () => {
            const apiKey = await context.secrets.get("opencodego.apiKey");
            if (!apiKey) {
                vscode.window.showWarningMessage(l10n("No API key configured. Please run the 'OpenCode Go: Set API Key' command first."));
                return;
            }
            const usage = await refreshGoUsageNow();
            if (!usage) {
                if (getUsageFetchStatus() === "unauthorized") {
                    vscode.window.showErrorMessage(l10n("OpenCode Go usage is unavailable (no active Go plan)."));
                } else {
                    vscode.window.showErrorMessage(l10n("Failed to fetch OpenCode Go usage. See output for details."));
                }
                return;
            }
            vscode.window.showInformationMessage(`OpenCode Go: ${formatUsageSummary(usage)}`);
        })
    );

    // Command to open the OpenCode Go website to get an API key
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.getApiKey", () => {
            vscode.env.openExternal(vscode.Uri.parse("https://opencode.ai/auth"));
        })
    );

    // Command to open extension settings
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.openSettings", () => {
            vscode.commands.executeCommand("workbench.action.openSettings", "@ext:OnesoftQwQ.opencode-go-copilot-provider");
        })
    );

    // Command to drop all registered session IDs so the next request of every
    // conversation is routed as a fresh session (escape hatch when session
    // affinity pins a conversation to a degraded backend).
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.resetSessionRouting", () => {
            const cleared = resetSessionRouting();
            logger.info("sessionRouting.reset", { cleared });
            vscode.window.showInformationMessage(
                l10nFormat("Session routing reset. The next request of each conversation will use a new session ID. ({0} cleared)", cleared)
            );
        })
    );

    // Register the generateGitCommitMessage command handler
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.generateGitCommitMessage", async (scm) => {
            generateCommitMsg(context.secrets, scm);
        }),
        vscode.commands.registerCommand("opencodego.abortGitCommitMessage", () => {
            abortCommitGeneration();
        }),
    );

    // Register the setModelPreset command: user can select a preset via QuickPick
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.setModelPreset", async () => {
            const config = vscode.workspace.getConfiguration();
            const presets = config.get<ModelPreset[]>("opencodego.modelPresets", []);
            const currentPresetId = config.get<string>("opencodego.modelPreset", "custom");
            const currentTemp = config.get<number | null>("opencodego.temperature", null);
            const currentTopP = config.get<number | null>("opencodego.top_p", null);

            interface PresetQuickPickItem extends vscode.QuickPickItem {
                presetId?: string;
            }

            // Mark the currently active preset with " (当前)"
            const presetItems: PresetQuickPickItem[] = presets.map((p) => ({
                label: `${l10n(p.label)} (${p.temperature})${p.id === currentPresetId ? l10n(" (current)") : ""}`,
                presetId: p.id,
            }));

            // Mark custom option with current values if active
            const isCustomActive = currentPresetId === "custom";
            const customLabel = "$(pencil) " + l10n("Custom (manual input)")
                + (isCustomActive
                    ? ` ${l10nFormat("(current, temperature: {0}, top_p: {1})", String(currentTemp ?? "—"), String(currentTopP ?? "—"))}`
                    : "");

            const customItem: PresetQuickPickItem = {
                label: customLabel,
            };

            const items: PresetQuickPickItem[] = [
                ...presetItems,
                { label: "", kind: vscode.QuickPickItemKind.Separator },
                customItem,
            ];

            const title = l10n("Set Model Preset");

            const picked = await vscode.window.showQuickPick(items, {
                title,
                placeHolder: l10n("Select a preset"),
                ignoreFocusOut: true,
            });

            if (!picked) {
                return;
            }

            const presetId = picked.presetId;

            if (presetId) {
                // User selected a named preset
                const matchedPreset = presets.find((p) => p.id === presetId);
                if (matchedPreset) {
                    await config.update("opencodego.modelPreset", matchedPreset.id, vscode.ConfigurationTarget.Global);
                    await config.update("opencodego.temperature", matchedPreset.temperature, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(
                        l10nFormat("Set to temperature: {0} ({1})", String(matchedPreset.temperature), l10n(matchedPreset.label))
                    );
                }
            } else {
                // User chose "Custom (manual input)"
                const currentVal = currentTemp !== null && currentTopP !== null
                    ? `${currentTemp},${currentTopP}`
                    : "";
                const inputValue = await vscode.window.showInputBox({
                    title: l10n("Enter custom temperature"),
                    prompt: l10n("Enter a single number for temperature only (<=2), or two comma-separated numbers for temperature and top_p (temp<=2, top_p<=1), e.g.: 0.7 or 0.7,0.95"),
                    value: currentVal,
                    validateInput: (val: string) => {
                        const trimmed = val.trim();
                        if (!trimmed) {
                            return l10n("Please enter at least temperature value");
                        }
                        const parts = trimmed.split(",");
                        if (parts.length > 2) {
                            return l10n("Please enter at most two numbers separated by a comma");
                        }
                        const temp = parseFloat(parts[0].trim());
                        if (isNaN(temp) || temp < 0 || temp > 2) {
                            return l10n("Temperature must be between 0.0 and 2.0");
                        }
                        if (parts.length === 2) {
                            const topP = parseFloat(parts[1].trim());
                            if (isNaN(topP) || topP < 0 || topP > 1) {
                                return l10n("top_p must be between 0.0 and 1.0");
                            }
                        }
                        return null;
                    },
                    ignoreFocusOut: true,
                });
                if (inputValue !== undefined) {
                    const trimmed = inputValue.trim();
                    const parts = trimmed.split(",");
                    const tempNum = parseFloat(parts[0].trim());
                    await config.update("opencodego.modelPreset", "custom", vscode.ConfigurationTarget.Global);
                    await config.update("opencodego.temperature", tempNum, vscode.ConfigurationTarget.Global);
                    if (parts.length === 2) {
                        const topPNum = parseFloat(parts[1].trim());
                        await config.update("opencodego.top_p", topPNum, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(
                            l10nFormat("Set to temp: {0}, top_p: {1} (custom)", String(tempNum), String(topPNum))
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            l10nFormat("Set to temperature: {0} (custom)", String(tempNum))
                        );
                    }
                }
            }
        })
    );

    // Command to set a custom inference Base URL (proxy). The compatibility
    // notice is shown as the QuickPick prompt (wrapped text above the list);
    // only after explicitly selecting "I Understand" does the Base URL input
    // box appear.
    context.subscriptions.push(
        vscode.commands.registerCommand("opencodego.setInferenceBaseUrl", async () => {
            interface BaseUrlNoticeItem extends vscode.QuickPickItem {
                ack?: boolean;
            }

            const ackItem: BaseUrlNoticeItem = {
                label: l10n("I Understand"),
                ack: true,
            };
            const cancelItem: BaseUrlNoticeItem = {
                label: l10n("Cancel"),
            };

            const picked = await vscode.window.showQuickPick<BaseUrlNoticeItem>(
                [ackItem, cancelItem],
                {
                    title: l10n("Set Proxy Base URL"),
                    placeHolder: l10n("Select 'I Understand' to continue, or press Esc to cancel"),
                    prompt: l10n("This feature is not for connecting to third-party providers — it is for routing requests through a local proxy service. All inference requests (chat and Git commit generation) are sent to this address. The proxy must be fully compatible with the official endpoint: same protocols and paths (/chat/completions, /responses, /v1/messages), same model IDs and headers (Authorization, x-opencode-session). Streaming (SSE) responses must pass through unchanged. Usage and model list requests still use the official endpoint. If you encounter problems after using a proxy, make sure the problem is not caused by the proxy before submitting an issue."),
                    ignoreFocusOut: true,
                }
            );
            if (!picked?.ack) {
                return; // user canceled or dismissed the notice
            }

            const config = vscode.workspace.getConfiguration();
            const current = config.get<string>("opencodego.inferenceBaseUrl", "");
            const input = await vscode.window.showInputBox({
                title: l10n("Set Proxy Base URL"),
                prompt: l10n("Enter the proxy base URL (e.g. https://proxy.example.com/zen/go/v1). Leave empty to clear the override and use the official endpoint."),
                value: current,
                ignoreFocusOut: true,
                validateInput: (value: string) => {
                    const trimmed = value.trim();
                    if (!trimmed) {
                        return undefined; // empty input clears the override
                    }
                    return validateBaseUrl(trimmed);
                },
            });
            if (input === undefined) {
                return; // user canceled
            }

            const trimmed = input.trim();
            if (!trimmed) {
                await config.update("opencodego.inferenceBaseUrl", undefined, vscode.ConfigurationTarget.Global);
                logger.info("settings.inferenceBaseUrl.cleared", {});
                vscode.window.showInformationMessage(l10n("Inference base URL override cleared. The official endpoint will be used."));
                return;
            }

            await config.update("opencodego.inferenceBaseUrl", trimmed, vscode.ConfigurationTarget.Global);
            logger.info("settings.inferenceBaseUrl.set", { baseUrl: trimmed });
            vscode.window.showInformationMessage(l10nFormat("Inference base URL set to: {0}", trimmed));
        })
    );

    // Warm up model discovery on every activation (non-blocking, fire-and-forget).
    // VS Code may fire several activation events at startup; the short refresh
    // interval in prepareLanguageModelChatInformation (default 1 minute) dedupes
    // concurrent calls so the API is not spammed. The models.dev catalog is
    // fetched before the model list. On failure it degrades silently to the
    // built-in model list.
    void prepareLanguageModelChatInformation(
        { silent: true },
        new vscode.CancellationTokenSource().token,
        context.secrets
    ).catch((error) => {
        logger.error("models.warmup.failed", {
            error: error instanceof Error ? error.message : String(error),
        });
    });

    // Show welcome walkthrough on first install (when no API key is configured)
    showWelcomeIfNeeded(context);

    // Dispose logger on deactivate
    context.subscriptions.push({
        dispose: () => logger.dispose(),
    });
}

/**
 * Show the welcome walkthrough on first activation if no API key is configured.
 * Once shown (or if a key already exists) the flag is persisted so it won't
 * reappear after subsequent reloads.
 */
async function showWelcomeIfNeeded(context: vscode.ExtensionContext): Promise<void> {
    try {
        if (context.globalState.get<boolean>(WELCOME_SHOWN_KEY)) {
            return;
        }
        const apiKey = await context.secrets.get("opencodego.apiKey");
        if (apiKey) {
            // API key already set — no need to show welcome
            await context.globalState.update(WELCOME_SHOWN_KEY, true);
            return;
        }
        await vscode.commands.executeCommand("workbench.action.openWalkthrough", WALKTHROUGH_ID, false);
        await context.globalState.update(WELCOME_SHOWN_KEY, true);
    } catch (error) {
        logger.warn("Failed to show welcome walkthrough", { error: String(error) });
    }
}

export function deactivate() { }
