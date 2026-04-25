import * as path from "path";
import * as vscode from "vscode";
import { getGitDiff } from "./gitUtils";
import { OpenaiApi } from "../openai/openaiApi";
import { logger } from "../logger";
import { l10n } from "../localize";
import type { OpenCodeGoModelItem } from "../types";

/**
 * Git commit message generator module.
 */

let commitGenerationAbortController: AbortController | undefined;

const DEFAULT_PROMPT = {
    system:
        "You are a helpful assistant that generates informative git commit messages based on git diffs output. Skip preamble and remove all backticks surrounding the commit message.\nBased on the provided git diff, generate a conventional format commit message.",
    user: "Notes from developer (ignore if not relevant): {{USER_CURRENT_INPUT}}",
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
        () => performCommitMsgGeneration(secrets, gitDiff, inputBox)
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

async function performCommitMsgGeneration(secrets: vscode.SecretStorage, gitDiff: string, inputBox: any) {
    const startTime = Date.now();
    let modelId: string | undefined;
    try {
        vscode.commands.executeCommand("setContext", "opencodego.isGeneratingCommit", true);
        const config = vscode.workspace.getConfiguration();

        const customSystemPrompt = config.get<string>("opencodego.commitMessagePrompt", "");
        const PROMPT = {
            system: customSystemPrompt || DEFAULT_PROMPT.system,
            user: DEFAULT_PROMPT.user,
        };

        const prompts: string[] = [];

        const currentInput = inputBox.value?.trim() || "";
        if (currentInput) {
            prompts.push(PROMPT.user.replace("{{USER_CURRENT_INPUT}}", currentInput));
        }

        const truncatedDiff =
            gitDiff.length > 5000 ? gitDiff.substring(0, 5000) + "\n\n[Diff truncated due to size]" : gitDiff;
        prompts.push(truncatedDiff);
        const prompt = prompts.join("\n\n");

        // Use model from config or default to deepseek-v4-flash
        const commitModelId = config.get<string>("opencodego.commitModel", "deepseek-v4-flash");
        const selectedModel: OpenCodeGoModelItem = { id: commitModelId, owned_by: "opencode" };
        modelId = selectedModel.id;
        logger.info("commit.start", { modelId });

        const apiKey = await ensureApiKey(secrets);
        if (!apiKey) {
            throw new Error(l10n("OpenCode Go API key not found"));
        }

        const baseUrl = selectedModel.baseUrl || "https://opencode.ai/zen/go/v1/";
        if (!baseUrl || !baseUrl.startsWith("http")) {
            throw new Error(l10n("Invalid base URL configuration."));
        }

        const commitLanguage = config.get<string>("opencodego.commitLanguage", "English");

        const systemPrompt = PROMPT.system + ` Generate commit message in ${commitLanguage}.`;

        const messages = [{ role: "user", content: prompt }];

        const apiInstance = new OpenaiApi(modelId);

        commitGenerationAbortController = new AbortController();
        const stream = apiInstance.createMessage(selectedModel, systemPrompt, messages, baseUrl, apiKey);

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
