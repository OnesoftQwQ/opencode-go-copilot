import * as vscode from "vscode";

export class VersionManager {
    private static _version: string | null = null;

    /**
     * Get the current extension version
     */
    static getVersion(): string {
        if (this._version === null) {
            const extension = vscode.extensions.getExtension("my-company.opencode-go-copilot");
            this._version = extension?.packageJSON?.version ?? "unknown";
        }
        return this._version!;
    }

    /**
     * Build a descriptive User-Agent to help quantify API usage
     */
    static getUserAgent(): string {
        const vscodeVersion = vscode.version;
        return `opencode-go-copilot/${this.getVersion()} VSCode/${vscodeVersion}`;
    }

    /**
     * Get the current extension information
     */
    static getClientInfo(): { name: string; version: string; author: string } {
        return {
            name: "opencode-go-copilot",
            version: this.getVersion(),
            author: "my-company",
        };
    }
}
