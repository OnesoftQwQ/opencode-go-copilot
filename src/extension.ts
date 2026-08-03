import * as vscode from "vscode";
import { OpenCodeGoChatModelProvider } from "./provider";
import { initStatusBar } from "./statusBar";
import { logger } from "./logger";
import { l10n, l10nFormat } from "./localize";
import type { ModelPreset } from "./types";
import { abortCommitGeneration, generateCommitMsg } from "./gitCommit/commitMessageGenerator";
import { TokenizerManager } from "./tokenizer/tokenizerManager";
import { prepareLanguageModelChatInformation, resetAutoDiscoveryState } from "./provideModel";

// ---- Walkthrough / Welcome constants ----

/** memento key tracking whether the welcome walkthrough has been shown. */
const WELCOME_SHOWN_KEY = "opencodego.welcomeShown";

/** Walkthrough contribution ID (publisher.extension#walkthroughId). */
const WALKTHROUGH_ID = "OnesoftQwQ.opencode-go-copilot-provider#opencodeGoGettingStarted";

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    logger.init();

    // Initialize TokenizerManager with extension path
    TokenizerManager.initialize(context.extensionPath);

    const tokenCountStatusBarItem: vscode.StatusBarItem = initStatusBar(context);
    const provider = new OpenCodeGoChatModelProvider(context.secrets, tokenCountStatusBarItem);

    // Register the OpenCode Go provider under the vendor id used in package.json
    vscode.lm.registerLanguageModelChatProvider("opencodego", provider);

    // Helper: check if an API key is stored (without prompting)
    const hasApiKey = async (): Promise<boolean> => {
        const key = await context.secrets.get("opencodego.apiKey");
        return !!key;
    };

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
