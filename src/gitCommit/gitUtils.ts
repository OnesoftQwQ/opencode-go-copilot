import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const GIT_OUTPUT_LINE_LIMIT = 500;

export interface GitCommit {
    hash: string;
    shortHash: string;
    subject: string;
    author: string;
    date: string;
}

async function checkGitRepo(cwd: string): Promise<boolean> {
    try {
        await execAsync("git rev-parse --git-dir", { cwd });
        return true;
    } catch {
        return false;
    }
}

async function checkGitInstalled(): Promise<boolean> {
    try {
        await execAsync("git --version");
        return true;
    } catch {
        return false;
    }
}

async function checkGitRepoHasCommits(cwd: string): Promise<boolean> {
    try {
        await execAsync("git rev-parse HEAD", { cwd });
        return true;
    } catch {
        return false;
    }
}

export async function searchCommits(query: string, cwd: string): Promise<GitCommit[]> {
    try {
        const isInstalled = await checkGitInstalled();
        if (!isInstalled) {
            console.error("Git is not installed");
            return [];
        }

        const isRepo = await checkGitRepo(cwd);
        if (!isRepo) {
            console.error("Not a git repository");
            return [];
        }

        if (!(await checkGitRepoHasCommits(cwd))) {
            return [];
        }

        const { stdout } = await execAsync(
            `git log -n 10 --format="%H%n%h%n%s%n%an%n%ad" --date=short ` +
            `--grep="${query}" --regexp-ignore-case`,
            { cwd }
        );

        let output = stdout;
        if (!output.trim() && /^[a-f0-9]+$/i.test(query)) {
            const { stdout: hashStdout } = await execAsync(
                `git log -n 10 --format="%H%n%h%n%s%n%an%n%ad" --date=short ` +
                `--author-date-order ${query}`,
                { cwd }
            ).catch(() => ({ stdout: "" }));

            if (!hashStdout.trim()) {
                return [];
            }

            output = hashStdout;
        }

        if (!output.trim()) {
            return [];
        }

        const lines = output.trim().split("\n");
        const commits: GitCommit[] = [];
        for (let i = 0; i + 4 < lines.length; i += 5) {
            commits.push({
                hash: lines[i].trim(),
                shortHash: lines[i + 1].trim(),
                subject: lines[i + 2].trim(),
                author: lines[i + 3].trim(),
                date: lines[i + 4].trim(),
            });
        }
        return commits;
    } catch (error) {
        console.error("Error searching commits:", error);
        return [];
    }
}

export async function getGitDiff(repoPath: string): Promise<string | undefined> {
    try {
        const isInstalled = await checkGitInstalled();
        if (!isInstalled) {
            console.error("Git is not installed");
            return undefined;
        }

        const isRepo = await checkGitRepo(repoPath);
        if (!isRepo) {
            console.error("Not a git repository");
            return undefined;
        }

        // Get staged diff (what will be committed)
        const { stdout } = await execAsync(
            `git diff --cached --unified=3 -- .`,
            { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
        );

        if (stdout.trim()) {
            return limitDiffLines(stdout.trim(), GIT_OUTPUT_LINE_LIMIT);
        }

        // Fall back to unstaged diff
        const { stdout: unstagedStdout } = await execAsync(
            `git diff --unified=3 -- .`,
            { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
        );

        if (unstagedStdout.trim()) {
            return limitDiffLines(unstagedStdout.trim(), GIT_OUTPUT_LINE_LIMIT);
        }

        return undefined;
    } catch (error) {
        console.error("Error getting git diff:", error);
        return undefined;
    }
}

function limitDiffLines(diff: string, maxLines: number): string {
    const lines = diff.split("\n");
    if (lines.length <= maxLines) {
        return diff;
    }
    return lines.slice(0, maxLines).join("\n") + `\n\n[Diff truncated: ${lines.length - maxLines} lines omitted]`;
}
