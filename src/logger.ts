import * as vscode from "vscode";

const SENSITIVE_HEADER_KEYS = ["Authorization", "x-api-key", "x-goog-api-key"];

class Logger {
    private _outputChannel!: vscode.LogOutputChannel;

    /**
     * Initialize the logger: create the VS Code Output channel.
     */
    init(): void {
        this._outputChannel = vscode.window.createOutputChannel("OpenCodeGo", { log: true });
    }

    debug(tag: string, data: Record<string, unknown>): void {
        this._outputChannel.debug(`[${tag}]`, JSON.stringify(data));
    }

    info(tag: string, data: Record<string, unknown>): void {
        this._outputChannel.info(`[${tag}]`, JSON.stringify(data));
    }

    warn(tag: string, data: Record<string, unknown>): void {
        this._outputChannel.warn(`[${tag}]`, JSON.stringify(data));
    }

    error(tag: string, data: Record<string, unknown>): void {
        this._outputChannel.error(`[${tag}]`, JSON.stringify(data));
    }

    /**
     * Sanitize headers by redacting sensitive values.
     */
    sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            const isSensitive = SENSITIVE_HEADER_KEYS.some(
                (k) => key.toLowerCase() === k.toLowerCase()
            );
            sanitized[key] = isSensitive ? "***" : value;
        }
        return sanitized;
    }

    /**
     * Dispose the output channel.
     */
    dispose(): void {
        this._outputChannel?.dispose();
    }
}

export const logger = new Logger();
