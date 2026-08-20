import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getGitDiff, getRecentCommits } from "./gitUtils";
import { OpenaiApi } from "../openai/openaiApi";
import { ResponsesApi } from "../openai/responsesApi";
import { AnthropicApi } from "../anthropic/anthropicApi";
import { getCatalogModelConfig } from "../catalogModels";
import { getCatalogProviderBaseUrl } from "../modelsDev";
import { logger } from "../logger";
import { l10n } from "../localize";
import type { OpenCodeGoModelItem } from "../types";

/**
 * Git commit message generator module.
 */

let commitGenerationAbortController: AbortController | undefined;

const DEFAULT_PROMPT = {
    system:
        "You are a helpful assistant that generates concise, informative git commit messages based on git diffs.\n\nGuidelines:\n- By default, use conventional commit format: <type>(<scope>): <description>\n- If reference commits are provided below, match their style and language instead\n- Keep the subject line under 72 characters\n- Use the imperative mood (\"add\" not \"added\" / \"adds\")\n- CRITICAL: Output ONLY the commit message itself — no preamble, no introduction, no explanations, no backticks\n- If the diff is large, focus on the most important changes",
    user: "Notes from developer (ignore if not relevant): {{USER_CURRENT_INPUT}}",
    styleReference: "\n\nRecent commit messages in this repository (match their style):\n{{RECENT_COMMITS}}",
};

export async function generateCommitMsg(secrets: vscode.SecretStorage, scm?: vscode.SourceControl) {
    try {
        const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
        if (!gitExtension) {
            throw new Error(l10n("Git extension not found"));
        }

        const git = gitExtension.getAPI(1);
        if (git.repositories.length === 0) {
            throw new Error(l10n("No Git repositories available"));
        }

        if (scm) {
            const repository = git.getRepository(scm.rootUri);

            if (!repository) {
                throw new Error(l10n("Repository not found for provided SCM"));
            }

            await generateCommitMsgForRepository(secrets, repository);
            return;
        }

        await orchestrateWorkspaceCommitMsgGeneration(secrets, git.repositories);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`${l10n("[Commit Generation Failed]")} ${errorMessage}`);
    }
}

async function orchestrateWorkspaceCommitMsgGeneration(secrets: vscode.SecretStorage, repos: any[]) {
    const reposWithChanges = await filterForReposWithChanges(repos);

    if (reposWithChanges.length === 0) {
        vscode.window.showInformationMessage(l10n("No changes found in any workspace repositories."));
        return;
    }

    if (reposWithChanges.length === 1) {
        const repo = reposWithChanges[0];
        await generateCommitMsgForRepository(secrets, repo);
        return;
    }

    const selection = await promptRepoSelection(reposWithChanges);

    if (!selection) {
        return;
    }

    if (selection.repo === null) {
        for (const repo of reposWithChanges) {
            try {
                await generateCommitMsgForRepository(secrets, repo);
            } catch (error) {
                console.error(`Failed to generate commit message for ${repo.rootUri.fsPath}:`, error);
            }
        }
    } else {
        await generateCommitMsgForRepository(secrets, selection.repo);
    }
}

async function filterForReposWithChanges(repos: any[]) {
    const reposWithChanges = [];

    for (const repo of repos) {
        try {
            const gitDiff = await getGitDiff(repo.rootUri.fsPath);
            if (gitDiff) {
                reposWithChanges.push(repo);
            }
        } catch {
            // Skip repositories with errors
        }
    }
    return reposWithChanges;
}

async function promptRepoSelection(repos: any[]) {
    const repoItems = repos.map((repo) => ({
        label: repo.rootUri.fsPath.split(path.sep).pop() || repo.rootUri.fsPath,
        description: repo.rootUri.fsPath,
        repo: repo,
    }));

    repoItems.unshift({
        label: "$(git-commit) Generate for all repositories with changes",
        description: `Generate commit messages for ${repos.length} repositories`,
        repo: null as any,
    });

    return await vscode.window.showQuickPick(repoItems, {
        placeHolder: "Select repository for commit message generation",
    });
}

async function generateCommitMsgForRepository(secrets: vscode.SecretStorage, repository: any) {
    const inputBox = repository.inputBox;
    const repoPath = repository.rootUri.fsPath;
    const gitDiff = await getGitDiff(repoPath);

    if (!gitDiff) {
        throw new Error(`No changes in repository ${repoPath.split(path.sep).pop() || "repository"} for commit message`);
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.SourceControl,
            title: `Generating commit message for ${repoPath.split(path.sep).pop() || "repository"}...`,
            cancellable: true,
        },
        (_, token) => {
            token.onCancellationRequested(() => {
                commitGenerationAbortController?.abort();
            });
            return performCommitMsgGeneration(secrets, gitDiff, inputBox, repoPath);
        }
    );
}

async function ensureApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    let apiKey = await secrets.get("opencodego.apiKey");

    if (!apiKey) {
        const entered = await vscode.window.showInputBox({
            title: l10n("OpenCode Go Provider API Key"),
            prompt: l10n("Enter your OpenCode Go API key"),
            ignoreFocusOut: true,
            password: true,
        });
        if (entered && entered.trim()) {
            apiKey = entered.trim();
            await secrets.store("opencodego.apiKey", apiKey);
        }
    }

    return apiKey;
}

async function performCommitMsgGeneration(secrets: vscode.SecretStorage, gitDiff: string, inputBox: any, repoPath?: string) {
    const startTime = Date.now();
    let modelId: string | undefined;
    try {
        vscode.commands.executeCommand("setContext", "opencodego.isGeneratingCommit", true);
        const config = vscode.workspace.getConfiguration();

        const customSystemPrompt = config.get<string>("opencodego.commitMessagePrompt", "");
        let systemPrompt = customSystemPrompt || DEFAULT_PROMPT.system;

        // Fetch recent commits for style reference
        const recentCommitsCount = config.get<number>("opencodego.recentCommitsCount", 10);
        const includeCommitDiff = config.get<boolean>("opencodego.commitIncludeCommitDiff", false);
        if (recentCommitsCount > 0 && repoPath) {
            const recentCommits = await getRecentCommits(repoPath, recentCommitsCount, { includeDiff: includeCommitDiff });
            if (recentCommits) {
                const styleRef = includeCommitDiff
                    ? "\n\nRecent commit messages and their changes in this repository (match their style):\n{{RECENT_COMMITS}}"
                    : DEFAULT_PROMPT.styleReference;
                systemPrompt += styleRef.replace("{{RECENT_COMMITS}}", recentCommits);
            }
        }

        const prompts: string[] = [];

        // Attach AGENTS.md and README.md context
        const attachContextFiles = config.get<boolean>("opencodego.commitAttachContextFiles", true);
        if (attachContextFiles && repoPath) {
            const contextFiles = ["AGENTS.md", "README.md"];
            for (const fileName of contextFiles) {
                const filePath = path.join(repoPath, fileName);
                try {
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, "utf-8").trim();
                        if (content) {
                            const truncated = content.length > 8000
                                ? content.substring(0, 8000) + "\n\n[Content truncated due to size]"
                                : content;
                            prompts.push(`[File: ${fileName}]\n${truncated}`);
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }
        }

        const currentInput = inputBox.value?.trim() || "";
        if (currentInput) {
            prompts.push(DEFAULT_PROMPT.user.replace("{{USER_CURRENT_INPUT}}", currentInput));
        }

        const truncatedDiff =
            gitDiff.length > 5000 ? gitDiff.substring(0, 5000) + "\n\n[Diff truncated due to size]" : gitDiff;
        prompts.push(truncatedDiff);
        const prompt = prompts.join("\n\n");

        // Use model from config or default to deepseek-v4-flash
        const commitModelId = config.get<string>("opencodego.commitModel", "deepseek-v4-flash");
        // Fetch full model config (apiMode, max_completion_tokens, extra, etc.)
        // Shallow copy to avoid mutating the shared resolved config.
        const selectedModel: OpenCodeGoModelItem = {
            ...getCatalogModelConfig(commitModelId)
        };
        // Commit messages are simple tasks — disable thinking when the catalog
        // says the model supports a disabled/none reasoning mode.
        if (selectedModel.thinkingMode !== "always") {
            selectedModel.enable_thinking = false;
        }
        // Cap max_completion_tokens to avoid proxy 500 errors with oversized values
        if (selectedModel.max_completion_tokens && selectedModel.max_completion_tokens > 8192) {
            selectedModel.max_completion_tokens = 8192;
        }
        modelId = selectedModel.id;
        logger.info("commit.start", { modelId });

        const apiKey = await ensureApiKey(secrets);
        if (!apiKey) {
            throw new Error(l10n("OpenCode Go API key not found"));
        }

        const baseUrl = selectedModel.baseUrl || getCatalogProviderBaseUrl("opencode-go", "https://opencode.ai/zen/go/v1/");
        if (!baseUrl || !baseUrl.startsWith("http")) {
            throw new Error(l10n("Invalid base URL configuration."));
        }
        {
            const url = new URL(baseUrl);
            if (url.protocol === "http:") {
                const host = url.hostname.toLowerCase();
                const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1"
                    || host.startsWith("192.168.") || host.startsWith("10.")
                    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
                    || host === "0.0.0.0";
                if (!isLocal) {
                    throw new Error(l10n("Plain HTTP is only allowed for localhost or private network addresses. Use HTTPS for remote endpoints."));
                }
            }
        }

        // Apply language instruction: auto mode lets the model infer from style reference
        const commitLanguage = config.get<string>("opencodego.commitLanguage", "auto");
        if (commitLanguage !== "auto") {
            systemPrompt += ` Generate commit message in ${commitLanguage}.`;
        }

        const messages = [{ role: "user", content: prompt }];

        // Use the appropriate API based on model config
        const apiMode = selectedModel.apiMode || "openai";

        const apiInstance = apiMode === "anthropic"
            ? new AnthropicApi(modelId)
            : apiMode === "openai-responses"
                ? new ResponsesApi(modelId)
                : new OpenaiApi(modelId);

        commitGenerationAbortController = new AbortController();
        const stream = apiInstance.createMessage(selectedModel, systemPrompt, messages, baseUrl, apiKey, commitGenerationAbortController.signal);

        let response = "";
        for await (const chunk of stream) {
            commitGenerationAbortController.signal.throwIfAborted();
            if (chunk.type === "text") {
                response += chunk.text;
                inputBox.value = extractCommitMessage(response);
            }
        }

        inputBox.value = removeThinkTags(inputBox.value);

        if (!inputBox.value) {
            throw new Error(l10n("empty API response"));
        }

        logger.info("commit.end", { modelId, durationMs: Date.now() - startTime });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("commit.error", { modelId: modelId ?? "unknown", error: errorMessage });
        vscode.window.showErrorMessage(`${l10n("Failed to generate commit message:")} ${errorMessage}`);
    } finally {
        vscode.commands.executeCommand("setContext", "opencodego.isGeneratingCommit", false);
    }
}

export function abortCommitGeneration() {
    commitGenerationAbortController?.abort();
    vscode.commands.executeCommand("setContext", "opencodego.isGeneratingCommit", false);
}

function extractCommitMessage(str: string): string {
    return str
        .trim()
        .replace(/^```[^\n]*\n?|```$/g, "")
        .trim();
}

function removeThinkTags(text: string): string {
    const regex = /<think>.*?<\/think>/gs;
    return text.replace(regex, "").trim();
}
