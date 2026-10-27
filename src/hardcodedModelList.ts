/**
 * Hardcoded fallback catalog snapshot.
 *
 * Last-resort fallback when both the official models.dev catalog and the
 * configured mirror are unreachable. Contains the complete opencode-go
 * (OpenCode Go) provider section exactly as published in the official
 * catalog — full model metadata included
 * (limit, cost, reasoning_options, attachment, modalities, ...), so the
 * fallback behaves like the real catalog instead of a bare ID list.
 *
 * Snapshot taken from the official models.dev catalog on 2026-10-27.
 */

import type { CatalogProvider, ModelsDevEntry } from "./modelsDev";

/**
 * Minimal catalog shape: global models map + provider sections.
 */
export interface HardcodedCatalogData {
    models: Record<string, ModelsDevEntry>;
    providers: Record<string, CatalogProvider>;
}

// Asserted like the runtime catalog JSON: the official snapshot's cost shapes
// vary between entries (some omit cache_read, some add cache_write), which the
// ModelsDevEntry type does not fully model.
export const HARDCODED_CATALOG: HardcodedCatalogData = {

  "models": {},
  "providers": {
    "opencode-go": {
      "id": "opencode-go",
      "env": [
        "OPENCODE_API_KEY"
      ],
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://opencode.ai/inference/go/openai/v1",
      "name": "OpenCode Go",
      "doc": "https://opencode.ai/v2/docs/console/go/",
      "models": {
        "mimo-v2.6-pro": {
          "id": "mimo-v2.6-pro",
          "name": "MiMo-V2.6-Pro",
          "description": "Stronger MiMo Pro tier for multimodal reasoning and coding-agent execution",
          "family": "mimo",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "release_date": "2026-09-22",
          "last_updated": "2026-09-22",
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.435,
            "output": 0.87,
            "cache_read": 0.003625
          },
          "canonical_model_id": "xiaomi/mimo-v2.6-pro"
        },
        "qwen3.8-flash": {
          "id": "qwen3.8-flash",
          "name": "Qwen3.8 Flash",
          "description": "Qwen vision-language model for visual reasoning, documents, and agent tasks",
          "family": "qwen",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "xhigh"
              ]
            },
            {
              "type": "budget_tokens"
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-26",
          "last_updated": "2026-08-26",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 0.15,
            "output": 0.47,
            "cache_read": 0.016,
            "cache_write": 0.2
          },
          "canonical_model_id": "alibaba/qwen3.8-flash"
        },
        "gpt-5.6-luna": {
          "id": "gpt-5.6-luna",
          "name": "GPT-5.6 Luna",
          "description": "Cost-efficient GPT-5.6 model for fast, high-volume workloads",
          "family": "gpt-luna",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "none",
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2026-02-16",
          "release_date": "2026-07-09",
          "last_updated": "2026-07-09",
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1050000,
            "input": 922000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.2,
            "output": 1.2,
            "cache_read": 0.02,
            "cache_write": 0.25,
            "tiers": [
              {
                "input": 0.4,
                "output": 1.8,
                "cache_read": 0.04,
                "cache_write": 0.5,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 0.4,
              "output": 1.8,
              "cache_read": 0.04,
              "cache_write": 0.5
            }
          },
          "canonical_model_id": "openai/gpt-5.6-luna"
        },
        "mimo-v2.5-pro": {
          "id": "mimo-v2.5-pro",
          "name": "MiMo V2.5 Pro",
          "description": "MiMo pro model for strong multimodal reasoning and agent execution",
          "family": "mimo-v2.5-pro",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2026-04-22",
          "last_updated": "2026-04-22",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1048576,
            "output": 128000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.435,
            "output": 0.87,
            "cache_read": 0.003625
          },
          "canonical_model_id": "xiaomi/mimo-v2.5-pro"
        },
        "minimax-m3.1-flash": {
          "id": "minimax-m3.1-flash",
          "name": "MiniMax M3.1 Flash",
          "description": "Frontier multimodal coding model with 1M context window and tunable thinking depth",
          "family": "minimax",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "release_date": "2026-10-19",
          "last_updated": "2026-10-19",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 512000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.015
          },
          "canonical_model_id": "minimax/MiniMax-M3.1-Flash"
        },
        "muse-spark-1.2-contributor": {
          "id": "muse-spark-1.2-contributor",
          "name": "Muse Spark 1.2 Contributor",
          "description": "Muse Spark 1.2 is a coding-focused update to Muse Spark 1.1 with improvements in code generation, complex debugging, codebase understanding, and end-to-end developer workflows.",
          "family": "muse",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high",
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-05",
          "last_updated": "2026-08-05",
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "pdf",
              "audio"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.1,
            "output": 0.2,
            "cache_read": 0.002
          },
          "canonical_model_id": "meta/muse-spark-1.2"
        },
        "claude-haiku-5-5": {
          "id": "claude-haiku-5-5",
          "name": "Claude Haiku 5.5",
          "description": "Fast Claude model for responsive assistance, classification, and lightweight agents",
          "family": "claude-haiku",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2026-06",
          "release_date": "2026-10-07",
          "last_updated": "2026-10-07",
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 0.1,
            "output": 0.5,
            "cache_read": 0.01,
            "cache_write": 0.125,
            "tiers": [
              {
                "input": 0.5,
                "output": 2.5,
                "cache_read": 0.05,
                "cache_write": 0.625,
                "tier": {
                  "type": "context",
                  "size": 100000
                }
              }
            ]
          },
          "canonical_model_id": "anthropic/claude-haiku-5-5"
        },
        "gemini-4-argon-contributor": {
          "id": "gemini-4-argon-contributor",
          "name": "Gemini 4 Argon Contributor",
          "description": "Google's flagship reasoning model for complex software engineering, deep math and science, and long-horizon autonomous agents",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2026-03",
          "release_date": "2026-10-13",
          "last_updated": "2026-10-13",
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://opencode.ai/inference/go/google/v1beta"
          },
          "cost": {
            "input": 4,
            "output": 20,
            "cache_read": 0.2,
            "input_audio": 4
          },
          "canonical_model_id": "google/gemini-4-argon"
        },
        "kimi-k2.7-code": {
          "id": "kimi-k2.7-code",
          "name": "Kimi K2.7 Code",
          "description": "Coding-focused Kimi model, stronger on long-horizon repo work with less overthinking",
          "family": "kimi-k2",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-01",
          "release_date": "2026-06-12",
          "last_updated": "2026-06-12",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 262144,
            "output": 262144
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.95,
            "output": 4,
            "cache_read": 0.19
          },
          "canonical_model_id": "moonshotai/kimi-k2.7-code"
        },
        "longcat-2.5-preview-free": {
          "id": "longcat-2.5-preview-free",
          "name": "LongCat 2.5 Preview Free",
          "description": "Meituan's multimodal reasoning model for coding and agent tasks, with image understanding and a 1M-token context window",
          "family": "longcat",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": false,
          "release_date": "2026-09-25",
          "last_updated": "2026-09-25",
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "status": "deprecated",
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          },
          "canonical_model_id": "meituan/longcat-2.5-preview"
        },
        "gemini-4-argon": {
          "id": "gemini-4-argon",
          "name": "Gemini 4 Argon",
          "description": "Google's flagship reasoning model for complex software engineering, deep math and science, and long-horizon autonomous agents",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2026-03",
          "release_date": "2026-10-13",
          "last_updated": "2026-10-13",
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 65536
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://opencode.ai/inference/go/google/v1beta"
          },
          "cost": {
            "input": 2,
            "output": 10,
            "cache_read": 0.1,
            "input_audio": 2
          },
          "canonical_model_id": "google/gemini-4-argon"
        },
        "minimax-m2.7": {
          "id": "minimax-m2.7",
          "name": "MiniMax-M2.7",
          "description": "MiniMax model for chat, coding, office work, and agentic tasks",
          "family": "minimax",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-03-18",
          "last_updated": "2026-03-18",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 204800,
            "output": 131072
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06,
            "cache_write": 0.375
          },
          "canonical_model_id": "minimax/MiniMax-M2.7"
        },
        "minimax-m3.1-flash-free": {
          "id": "minimax-m3.1-flash-free",
          "name": "MiniMax M3.1 Flash Free",
          "description": "Frontier multimodal coding model with 1M context window and tunable thinking depth",
          "family": "minimax",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "release_date": "2026-10-19",
          "last_updated": "2026-10-19",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 512000
          },
          "status": "deprecated",
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          },
          "canonical_model_id": "minimax/MiniMax-M3.1-Flash"
        },
        "kimi-k3": {
          "id": "kimi-k3",
          "name": "Kimi K3",
          "description": "Multimodal Kimi model with 1M context and toggleable max-effort thinking for long-horizon agent work",
          "family": "kimi-k3",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": false,
          "release_date": "2026-07-16",
          "last_updated": "2026-07-16",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3,
            "cache_write": 3
          },
          "canonical_model_id": "moonshotai/kimi-k3"
        },
        "deepseek-v4.1-flash": {
          "id": "deepseek-v4.1-flash",
          "name": "DeepSeek V4.1 Flash",
          "description": "DeepSeek V4.1 Flash model for reasoning and agentic coding",
          "family": "deepseek-flash",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-05",
          "release_date": "2026-09-10",
          "last_updated": "2026-09-10",
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 384000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.003
          },
          "canonical_model_id": "deepseek/deepseek-v4.1-flash"
        },
        "minimax-m3": {
          "id": "minimax-m3",
          "name": "MiniMax-M3",
          "description": "MiniMax multimodal coding model for long-context reasoning and agent tasks",
          "family": "minimax-m3",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-06-01",
          "last_updated": "2026-06-01",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06,
            "tiers": [
              {
                "input": 0.6,
                "output": 2.4,
                "cache_read": 0.12,
                "tier": {
                  "type": "context",
                  "size": 512000
                }
              }
            ],
            "context_over_200k": {
              "input": 0.6,
              "output": 2.4,
              "cache_read": 0.12
            }
          },
          "canonical_model_id": "minimax/MiniMax-M3"
        },
        "glm-5.2": {
          "id": "glm-5.2",
          "name": "GLM-5.2",
          "description": "Open flagship GLM for long-horizon coding agents and million-token context work",
          "family": "glm",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-06-13",
          "last_updated": "2026-06-13",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          },
          "canonical_model_id": "zhipuai/glm-5.2"
        },
        "muse-spark-1.3-contributor": {
          "id": "muse-spark-1.3-contributor",
          "name": "Muse Spark 1.3 Contributor",
          "description": "Muse Spark 1.3 is a multimodal reasoning model from Meta for coding and agentic workflows.",
          "family": "muse",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high",
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-09-02",
          "last_updated": "2026-09-02",
          "modalities": {
            "input": [
              "text",
              "image",
              "video",
              "pdf",
              "audio"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.1,
            "output": 0.2,
            "cache_read": 0.002
          },
          "canonical_model_id": "meta/muse-spark-1.3"
        },
        "step-5-preview-free": {
          "id": "step-5-preview-free",
          "name": "Step 5 Preview Free",
          "description": "StepFun's next-generation flagship base model for coding and professional knowledge work, with native text, image, and video input and a 1M-token context window",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-09-16",
          "last_updated": "2026-09-20",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "input": 1000000,
            "output": 65536
          },
          "status": "deprecated",
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          },
          "canonical_model_id": "stepfun/step-5-preview"
        },
        "hy3": {
          "id": "hy3",
          "name": "Hy3",
          "description": "Tencent Hy reasoning model for coding, instruction following, and agent tasks",
          "family": "Hy",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "none",
                "low",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "temperature": true,
          "release_date": "2026-07-06",
          "last_updated": "2026-07-06",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 256000,
            "input": 192000,
            "output": 128000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.14,
            "output": 0.58,
            "cache_read": 0.035
          },
          "canonical_model_id": "tencent/hy3"
        },
        "hy4-preview": {
          "id": "hy4-preview",
          "name": "Hy4 preview",
          "description": "A next-generation productivity model with significantly enhanced Agent and complex task execution capabilities.",
          "family": "Hy",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "none",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "temperature": true,
          "release_date": "2026-08-28",
          "last_updated": "2026-08-28",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1024000,
            "output": 64000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.834,
            "output": 2.501,
            "cache_read": 0.042
          },
          "canonical_model_id": "tencent/hy4-preview"
        },
        "step-5-preview": {
          "id": "step-5-preview",
          "name": "Step 5 Preview",
          "description": "StepFun's next-generation flagship base model for coding and professional knowledge work, with native text, image, and video input and a 1M-token context window",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-09-16",
          "last_updated": "2026-09-20",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "input": 1000000,
            "output": 65536
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 1,
            "output": 2.7,
            "cache_read": 0.1
          },
          "canonical_model_id": "stepfun/step-5-preview"
        },
        "gpt-6-luna": {
          "id": "gpt-6-luna",
          "name": "GPT-6 Luna",
          "description": "OpenAI's most efficient model for focused, high-volume tasks",
          "family": "gpt-luna",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "none",
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2026-05-18",
          "release_date": "2026-09-22",
          "last_updated": "2026-09-22",
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1050000,
            "input": 922000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.1,
            "output": 0.5,
            "cache_read": 0.01,
            "cache_write": 0.125,
            "tiers": [
              {
                "input": 0.2,
                "output": 0.75,
                "cache_read": 0.02,
                "cache_write": 0.25,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 0.2,
              "output": 0.75,
              "cache_read": 0.02,
              "cache_write": 0.25
            }
          },
          "canonical_model_id": "openai/gpt-6-luna"
        },
        "iceman-contributor-free": {
          "id": "iceman-contributor-free",
          "name": "Iceman Contributor Free",
          "description": "Stealth model, free for a limited time",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "release_date": "2026-10-24",
          "last_updated": "2026-10-24",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 262144,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "longcat-2.0": {
          "id": "longcat-2.0",
          "name": "LongCat-2.0",
          "description": "Meituan LongCat-2.0, a reasoning model with tool calling and a 1M-token context window",
          "family": "longcat",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "release_date": "2026-06-30",
          "last_updated": "2026-06-30",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.006
          },
          "canonical_model_id": "meituan/longcat-2.0"
        },
        "grok-4.7": {
          "id": "grok-4.7",
          "name": "Grok 4.7",
          "description": "xAI's frontier model for long-running agents, coding, knowledge work, and visual projects",
          "family": "grok",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2026-05",
          "release_date": "2026-09-21",
          "last_updated": "2026-09-21",
          "modalities": {
            "input": [
              "text",
              "image",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 500000,
            "output": 500000
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.5,
            "tiers": [
              {
                "input": 4,
                "output": 12,
                "cache_read": 1,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 4,
              "output": 12,
              "cache_read": 1
            }
          },
          "canonical_model_id": "xai/grok-4.7"
        },
        "qwen3.8-max": {
          "id": "qwen3.8-max",
          "name": "Qwen3.8 Max",
          "description": "2.4-trillion-parameter multimodal flagship for coding, professional work, and long-horizon agentic workflows",
          "family": "qwen3.8-max",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "xhigh"
              ]
            },
            {
              "type": "budget_tokens",
              "max": 262144
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-03",
          "last_updated": "2026-08-03",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.25,
            "cache_write": 2.5
          },
          "canonical_model_id": "alibaba/qwen3.8-max"
        },
        "deepseek-v4-pro": {
          "id": "deepseek-v4-pro",
          "name": "DeepSeek V4 Pro (New)",
          "description": "Flagship DeepSeek model for coding, reasoning, and agentic work",
          "family": "deepseek-thinking",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-05",
          "release_date": "2026-04-24",
          "last_updated": "2026-04-24",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 384000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.66,
            "output": 1.98,
            "cache_read": 0.022
          },
          "canonical_model_id": "deepseek/deepseek-v4-pro"
        },
        "mimo-v2.6-flash": {
          "id": "mimo-v2.6-flash",
          "name": "MiMo-V2.6-Flash",
          "description": "MiMo Flash model for multimodal coding agents and long-context automation",
          "family": "mimo",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "release_date": "2026-09-22",
          "last_updated": "2026-09-22",
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.14,
            "output": 0.28,
            "cache_read": 0.0028
          },
          "canonical_model_id": "xiaomi/mimo-v2.6-flash"
        },
        "cat-jam-free": {
          "id": "cat-jam-free",
          "name": "Cat Jam Free",
          "description": "A text-only reasoning model for coding and agentic workflows, with tool calling and structured JSON outputs.",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-10-12",
          "last_updated": "2026-10-12",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "status": "deprecated",
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "glm-5.3": {
          "id": "glm-5.3",
          "name": "GLM-5.3",
          "description": "Flagship GLM model for long-horizon coding, agents, and complex project delivery",
          "family": "glm",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-14",
          "last_updated": "2026-08-14",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          },
          "canonical_model_id": "zhipuai/glm-5.3"
        },
        "kimi-k3.1-pro": {
          "id": "kimi-k3.1-pro",
          "name": "Kimi K3.1 Pro",
          "description": "Multimodal Kimi model with 1M context and always-on reasoning for coding, 3D creation, financial research, and agentic work",
          "family": "kimi-k3",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": false,
          "release_date": "2026-10-23",
          "last_updated": "2026-10-23",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 2,
            "output": 10,
            "cache_read": 0.2,
            "cache_write": 2
          },
          "canonical_model_id": "moonshotai/kimi-k3.1-pro"
        },
        "space-bunny": {
          "id": "space-bunny",
          "name": "Space Bunny",
          "description": "Anonymous preview reasoning model for coding, agentic tasks, tool use, and multimodal input",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "release_date": "2026-09-23",
          "last_updated": "2026-09-23",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1048576,
            "input": 524288,
            "output": 524288
          },
          "status": "deprecated",
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.03,
            "cache_write": 0
          }
        },
        "beam-free": {
          "id": "beam-free",
          "name": "Beam Free",
          "description": "Sparse mixture-of-experts reasoning model with 23B active parameters for coding and agentic workflows",
          "family": "beam",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "xhigh",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "knowledge": "2026-06-30",
          "release_date": "2026-10-05",
          "last_updated": "2026-10-16",
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1048576,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          },
          "canonical_model_id": "reflection/beam-1.0-501b-a23b"
        },
        "mimo-v2.5": {
          "id": "mimo-v2.5",
          "name": "MiMo V2.5",
          "description": "MiMo omni model for text, image, video, audio, and agents",
          "family": "mimo-v2.5",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2026-04-22",
          "last_updated": "2026-04-22",
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 128000
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.14,
            "output": 0.28,
            "cache_read": 0.0028
          },
          "canonical_model_id": "xiaomi/mimo-v2.5"
        },
        "qwen3.7-plus": {
          "id": "qwen3.7-plus",
          "name": "Qwen3.7 Plus",
          "description": "Multimodal reasoning model for visual analysis, planning, and tool use",
          "family": "qwen3.7-plus",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 262144
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-06-02",
          "last_updated": "2026-06-02",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 65536
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://opencode.ai/inference/go/anthropic/v1"
          },
          "cost": {
            "input": 0.4,
            "output": 1.6,
            "cache_read": 0.04,
            "cache_write": 0.5,
            "tiers": [
              {
                "input": 1.2,
                "output": 4.8,
                "cache_read": 0.12,
                "cache_write": 1.5,
                "tier": {
                  "type": "context",
                  "size": 256000
                }
              }
            ],
            "context_over_200k": {
              "input": 1.2,
              "output": 4.8,
              "cache_read": 0.12,
              "cache_write": 1.5
            }
          },
          "canonical_model_id": "alibaba/qwen3.7-plus"
        },
        "glm-5.3-flash": {
          "id": "glm-5.3-flash",
          "name": "GLM-5.3-Flash",
          "description": "Native multimodal GLM model for efficient coding and long-horizon agent tasks",
          "family": "glm-flash",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "high",
                "max"
              ]
            }
          ],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-26",
          "last_updated": "2026-08-26",
          "modalities": {
            "input": [
              "text",
              "image",
              "video"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "provider": {
            "api": "https://opencode.ai/inference/go/openai/v1"
          },
          "cost": {
            "input": 0.15,
            "output": 0.5,
            "cache_read": 0.03
          },
          "canonical_model_id": "zhipuai/glm-5.3-flash"
        }
      }
    }
  }

} as unknown as HardcodedCatalogData;
