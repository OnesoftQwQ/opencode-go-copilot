/**
 * Official OpenCode Go endpoint constants.
 *
 * The models.dev catalog publishes the *inference* base URL in
 * `providers["opencode-go"].api` (currently an /inference/go/<protocol>/...
 * path). The control-plane endpoints (plan usage and the API model list) are
 * not served from that base — they only exist under the Zen gateway — so they
 * must never inherit the catalog's inference base (#144).
 */

/**
 * Base URL for the OpenCode Go control-plane endpoints:
 * `GET {base}/usage` and `GET {base}/models`.
 *
 * This is deliberately a constant: usage and model list requests always go to
 * the official endpoint, even when the user configures an inference proxy
 * (see `opencodego.inferenceBaseUrl`) or when the catalog points inference at
 * a protocol-specific /inference base.
 */
export const OFFICIAL_CONTROL_PLANE_BASE_URL = "https://opencode.ai/zen/go/v1/";
