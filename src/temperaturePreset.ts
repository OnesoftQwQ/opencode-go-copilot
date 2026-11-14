/**
 * Temperature / top_p selection from the user's model preset.
 *
 * The built-in `default` preset sends neither parameter, so each model falls
 * back to the provider's own default. This keeps instructions like a fixed
 * temperature from reaching routes that reject it (issue #152) and mirrors
 * OpenCode v2, which no longer sends a temperature at all (issue #151).
 */

import type { ModelPreset, OpenCodeGoModelItem } from "./types";

/** Preset id meaning "omit temperature/top_p and use the provider default". */
export const DEFAULT_PRESET_ID = "default";

/** Preset id meaning "use the manual opencodego.temperature / top_p settings". */
export const CUSTOM_PRESET_ID = "custom";

/**
 * Apply the active preset to a request model config.
 *
 * - `default` preset → both parameters stay undefined (provider default).
 * - `custom` → the manual settings are applied when set.
 * - any other preset → its temperature is sent; top_p is left to the model.
 *
 * Routes that declare `supportsTemperature: false` never receive either
 * parameter, regardless of the preset.
 */
export function applyTemperaturePreset(
    um: OpenCodeGoModelItem,
    presetId: string,
    presets: ModelPreset[],
    userTemperature: number | null,
    userTopP: number | null,
): void {
    if (um.supportsTemperature === false) {
        // Model does not support temperature; ensure it's not sent.
        um.temperature = undefined;
        um.top_p = undefined;
        return;
    }

    if (presetId !== CUSTOM_PRESET_ID) {
        const matchedPreset = presets.find((p) => p.id === presetId);
        const presetTemperature = matchedPreset?.temperature;
        // Undefined/null preset temperature (the built-in `default` preset)
        // leaves the attribute unset, so the parameter is not sent.
        um.temperature = presetTemperature ?? undefined;
        // Preset mode never sends top_p; the model uses its default.
        um.top_p = undefined;
        return;
    }

    if (userTemperature !== null) {
        um.temperature = userTemperature;
    }
    if (userTopP !== null) {
        um.top_p = userTopP;
    } else {
        // Keep top_p undefined so the model uses its default
        um.top_p = undefined;
    }
}
