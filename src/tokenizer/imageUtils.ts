export function getImageDimensions(base64: string) {
    if (!base64.startsWith("data:image/")) {
        throw new Error("Could not read image: invalid base64 image string");
    }
    const rawString = base64.split(",")[1];
    switch (getMimeType(rawString)) {
        case "image/png":
            return getPngDimensions(rawString);
        case "image/gif":
            return getGifDimensions(rawString);
        case "image/jpeg":
        case "image/jpg":
            return getJpegDimensions(rawString);
        case "image/webp":
            return getWebPDimensions(rawString);
        default:
            throw new Error("Unsupported image format");
    }
}

function getMimeType(base64: string): string {
    // Read first few bytes to determine image type
    const header = atob(base64.slice(0, 20));
    if (header.startsWith("ÿØÿà") || header.startsWith("ÿØÿá") || header.startsWith("ÿØÿâ")) {
        return "image/jpeg";
    }
    if (header.startsWith("RIFF")) {
        return "image/webp";
    }
    if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
        return "image/gif";
    }
    // Default assume PNG (PNG signatures start with byte 137 'PNG'...)
    // atob of the first few bytes will contain the PNG signature
    const uint8 = new Uint8Array(base64.length);
    for (let i = 0; i < base64.length; i++) {
        uint8[i] = base64.charCodeAt(i);
    }
    if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
        return "image/png";
    }
    return "unknown";
}

export function getPngDimensions(base64: string) {
    const header = atob(base64.slice(0, 50)).slice(16, 24);
    const uint8 = Uint8Array.from(header, (c) => c.charCodeAt(0));
    const dataView = new DataView(uint8.buffer);

    return {
        width: dataView.getUint32(0, false),
        height: dataView.getUint32(4, false),
    };
}

export function getGifDimensions(base64: string) {
    const header = atob(base64.slice(0, 50));
    const uint8 = Uint8Array.from(header, (c) => c.charCodeAt(0));
    const dataView = new DataView(uint8.buffer);

    return {
        width: dataView.getUint16(6, true),
        height: dataView.getUint16(8, true),
    };
}

export function getJpegDimensions(base64: string) {
    const binary = atob(base64);
    const uint8 = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const length = uint8.length;
    let offset = 2;

    while (offset < length) {
        const marker = (uint8[offset] << 8) | uint8[offset + 1];
        const segmentLength = (uint8[offset + 2] << 8) | uint8[offset + 3];

        if (marker >= 0xffc0 && marker <= 0xffc2) {
            const dataView = new DataView(uint8.buffer, offset + 5, 4);
            return {
                height: dataView.getUint16(0, false),
                width: dataView.getUint16(2, false),
            };
        }

        offset += 2 + segmentLength;
    }

    throw new Error("JPEG dimensions not found");
}

export function getWebPDimensions(base64String: string) {
    const binaryString = atob(base64String);
    const binaryData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        binaryData[i] = binaryString.charCodeAt(i);
    }

    if (binaryString.slice(0, 4) !== "RIFF" || binaryString.slice(8, 12) !== "WEBP") {
        throw new Error("Not a valid WebP image.");
    }

    const chunkHeader = binaryString.slice(12, 16);

    if (chunkHeader === "VP8 ") {
        // Lossy WebP
        const dataView = new DataView(binaryData.buffer, 26, 4);
        return {
            width: dataView.getUint16(0, true) & 0x3fff,
            height: dataView.getUint16(2, true) & 0x3fff,
        };
    } else if (chunkHeader === "VP8L") {
        // Lossless WebP
        const dataView = new DataView(binaryData.buffer, 21, 4);
        const bits = dataView.getUint32(0, true);
        return {
            width: (bits & 0x3fff) + 1,
            height: ((bits >> 14) & 0x3fff) + 1,
        };
    } else if (chunkHeader === "VP8X") {
        // Extended WebP
        const dataView = new DataView(binaryData.buffer, 24, 6);
        const width = ((dataView.getUint16(0, true) | ((dataView.getUint8(2) & 0x3f) << 16)) + 1) & 0xffffff;
        const height = (((dataView.getUint8(2) >> 6) | (dataView.getUint16(3, true) << 2)) + 1) & 0xffffff;
        return { width, height };
    }

    throw new Error("Unknown WebP format.");
}
