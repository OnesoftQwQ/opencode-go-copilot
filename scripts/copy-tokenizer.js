/**
 * Post-install script to ensure the tiktoken model file exists in assets/model/.
 * If not found locally, downloads from OpenAI's public storage.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const TOKENIZER_URL = "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken";

function downloadFile(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		https
			.get(url, (response) => {
				if (response.statusCode !== 200) {
					reject(new Error(`Download failed: HTTP ${response.statusCode}`));
					return;
				}
				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			})
			.on("error", (err) => {
				try { fs.unlinkSync(dest); } catch { /* ignore */ }
				reject(err);
			});
	});
}

async function ensureTokenizerFile() {
	const destDir = path.join(__dirname, "..", "assets", "model");
	const destFile = path.join(destDir, "o200k_base.tiktoken");

	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}

	if (fs.existsSync(destFile)) {
		console.log("[opencode-go-copilot] Tokenizer file already exists at:", destFile);
		return;
	}

	console.log("[opencode-go-copilot] Downloading tokenizer file from:", TOKENIZER_URL);
	try {
		await downloadFile(TOKENIZER_URL, destFile);
		console.log("[opencode-go-copilot] Tokenizer file downloaded to:", destFile);
	} catch (err) {
		console.warn("[opencode-go-copilot] Failed to download tokenizer file:", err.message);
		console.warn("[opencode-go-copilot] Token counting will fall back to estimation.");
	}
}

ensureTokenizerFile().catch((err) => {
	console.warn("[opencode-go-copilot] Tokenizer setup failed:", err.message);
	console.warn("[opencode-go-copilot] Token counting will fall back to estimation.");
});
