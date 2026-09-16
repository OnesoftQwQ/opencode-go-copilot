/**
 * Regression checks for data URI image decoding (utils.ts).
 *
 * storeDataUriImages used atob, which throws InvalidCharacterError on
 * payloads that are not strictly encoded — e.g. a stray "=" padding left
 * over when two base64 chunks are captured together (#68). Decoding now
 * goes through Buffer.from(..., "base64") and must keep working for those
 * inputs.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const vscodeShim = {
    env: { language: "en" },
    workspace: {
        getConfiguration: () => ({
            get: (_key, fallback) => fallback,
        }),
    },
    window: {
        createOutputChannel: () => ({
            debug() {},
            info() {},
            warn() {},
            error() {},
            dispose() {},
        }),
    },
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
        return vscodeShim;
    }
    return originalLoad.call(this, request, parent, isMain);
};

try {
    const { storeDataUriImages } = require("../out/utils.js");

    // A plain data URI decodes to its exact bytes.
    {
        const images = [];
        const count = storeDataUriImages("see data:image/png;base64,aGVsbG8= end", images);
        assert.equal(count, 1);
        assert.equal(images.length, 1);
        assert.equal(images[0].mimeType, "image/png");
        assert.deepEqual(Array.from(images[0].data), Array.from(Buffer.from("hello")));
    }

    // JPEG payloads keep their mime type.
    {
        const images = [];
        storeDataUriImages("data:image/jpeg;base64,aGVsbG8=", images);
        assert.equal(images[0].mimeType, "image/jpeg");
    }

    // Regression (#68): atob threw on a run containing a stray "=" before the
    // end; the Buffer-based decode must not throw and decodes the leading
    // payload.
    {
        const images = [];
        const count = storeDataUriImages("data:image/png;base64,aGVsbG8=aGVsbG8=", images);
        assert.equal(count, 1);
        assert.equal(images.length, 1);
        assert.deepEqual(Array.from(images[0].data), Array.from(Buffer.from("hello")));
    }

    // Multiple data URI images in one text are all stored.
    {
        const images = [];
        const count = storeDataUriImages(
            "data:image/png;base64,aGVsbG8= and data:image/webp;base64,aGVsbG8=",
            images
        );
        assert.equal(count, 2);
        assert.equal(images.length, 2);
        assert.equal(images[0].mimeType, "image/png");
        assert.equal(images[1].mimeType, "image/webp");
    }

    console.log("store data uri: ok");
} finally {
    Module._load = originalLoad;
}
