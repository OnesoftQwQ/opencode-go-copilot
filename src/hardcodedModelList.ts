/**
 * Hardcoded fallback catalog snapshot.
 *
 * Last-resort fallback when both the official models.dev catalog and the
 * configured mirror are unreachable. Contains the complete provider sections
 * for opencode-go (OpenCode Go) and opencode (OpenCode Zen) exactly as
 * published in the official catalog — full model metadata included
 * (limit, cost, reasoning_options, attachment, modalities, ...), so the
 * fallback behaves like the real catalog instead of a bare ID list.
 *
 * Snapshot taken from the official models.dev catalog on 2026-08-20.
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
      "api": "https://opencode.ai/zen/go/v1",
      "name": "OpenCode Go",
      "doc": "https://opencode.ai/docs/zen",
      "models": {
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
          "cost": {
            "input": 0.95,
            "output": 4,
            "cache_read": 0.19
          }
        },
        "qwen3.7-max": {
          "id": "qwen3.7-max",
          "name": "Qwen3.7 Max",
          "description": "Flagship model for demanding analysis, coding, and production agent workflows",
          "family": "qwen3.7-max",
          "attachment": false,
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
          "release_date": "2026-05-21",
          "last_updated": "2026-05-21",
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
            "context": 1000000,
            "output": 65536
          },
          "cost": {
            "input": 2.5,
            "output": 7.5,
            "cache_read": 0.5,
            "cache_write": 3.125
          }
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
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3
          }
        },
        "deepseek-v4-flash": {
          "id": "deepseek-v4-flash",
          "name": "DeepSeek V4 Flash",
          "description": "Official DeepSeek V4 Flash release with enhanced agentic capabilities and integrated DSpark speculative decoding",
          "family": "deepseek-flash",
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
          "knowledge": "2025-05",
          "release_date": "2026-07-31",
          "last_updated": "2026-07-31",
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
          "cost": {
            "input": 0.22,
            "output": 0.66,
            "cache_read": 0.007
          }
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
          "cost": {
            "input": 0.14,
            "output": 0.28,
            "cache_read": 0.0028
          }
        },
        "grok-4.5": {
          "id": "grok-4.5",
          "name": "Grok 4.5",
          "description": "xAI's Grok model for chat, coding, agentic tools, and lower hallucination risk",
          "family": "grok",
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
          "temperature": true,
          "release_date": "2026-07-08",
          "last_updated": "2026-07-08",
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
            "context": 500000,
            "output": 500000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
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
          }
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
          "cost": {
            "input": 0.66,
            "output": 1.98,
            "cache_read": 0.022
          }
        },
        "qwen3.5-plus": {
          "id": "qwen3.5-plus",
          "name": "Qwen3.5 Plus",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "qwen3.5",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 81920
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-02-16",
          "last_updated": "2026-02-16",
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
            "context": 262144,
            "output": 65536
          },
          "status": "deprecated",
          "cost": {
            "input": 0.2,
            "output": 1.2,
            "cache_read": 0.02,
            "cache_write": 0.25
          }
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
            "npm": "@ai-sdk/openai"
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
          }
        },
        "glm-5": {
          "id": "glm-5",
          "name": "GLM-5",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "glm",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-02-11",
          "last_updated": "2026-02-11",
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
            "context": 202752,
            "output": 32768
          },
          "status": "deprecated",
          "cost": {
            "input": 1,
            "output": 3.2,
            "cache_read": 0.2
          }
        },
        "minimax-m3": {
          "id": "minimax-m3",
          "name": "MiniMax-M3",
          "description": "MiniMax multimodal coding model for long-context reasoning and agent tasks",
          "family": "minimax-m3",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-05-31",
          "last_updated": "2026-05-31",
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
            "npm": "@ai-sdk/anthropic"
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
          }
        },
        "minimax-m2.7": {
          "id": "minimax-m2.7",
          "name": "MiniMax-M2.7",
          "description": "MiniMax model for chat, coding, office work, and agentic tasks",
          "family": "minimax-m2.7",
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
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06
          }
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
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.25,
            "cache_write": 2.5
          }
        },
        "mimo-v2-pro": {
          "id": "mimo-v2-pro",
          "name": "MiMo V2 Pro",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "mimo-v2-pro",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
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
            "context": 1048576,
            "output": 128000
          },
          "status": "deprecated",
          "cost": {
            "input": 1,
            "output": 3,
            "cache_read": 0.2,
            "tiers": [
              {
                "input": 2,
                "output": 6,
                "cache_read": 0.4,
                "tier": {
                  "type": "context",
                  "size": 256000
                }
              }
            ],
            "context_over_200k": {
              "input": 2,
              "output": 6,
              "cache_read": 0.4
            }
          }
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
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          }
        },
        "kimi-k2.5": {
          "id": "kimi-k2.5",
          "name": "Kimi K2.5",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "kimi-k2",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2026-01-27",
          "last_updated": "2026-01-27",
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
            "output": 65536
          },
          "status": "deprecated",
          "cost": {
            "input": 0.6,
            "output": 3,
            "cache_read": 0.1
          }
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
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          }
        },
        "minimax-m2.5": {
          "id": "minimax-m2.5",
          "name": "MiniMax-M2.5",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "minimax-m2.5",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-02-12",
          "last_updated": "2026-02-12",
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
            "output": 65536
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.03
          }
        },
        "mimo-v2-omni": {
          "id": "mimo-v2-omni",
          "name": "MiMo V2 Omni",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "mimo-v2-omni",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2026-03-18",
          "last_updated": "2026-03-18",
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 262144,
            "output": 128000
          },
          "status": "deprecated",
          "cost": {
            "input": 0.4,
            "output": 2,
            "cache_read": 0.08
          }
        },
        "qwen3.6-plus": {
          "id": "qwen3.6-plus",
          "name": "Qwen3.6 Plus",
          "description": "Multimodal reasoning model for visual analysis, planning, and tool use",
          "family": "qwen3.6",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 81920
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-04-02",
          "last_updated": "2026-04-02",
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
          "cost": {
            "input": 0.5,
            "output": 3,
            "cache_read": 0.05,
            "cache_write": 0.625,
            "tiers": [
              {
                "input": 2,
                "output": 6,
                "cache_read": 0.2,
                "cache_write": 2.5,
                "tier": {
                  "type": "context",
                  "size": 256000
                }
              }
            ],
            "context_over_200k": {
              "input": 2,
              "output": 6,
              "cache_read": 0.2,
              "cache_write": 2.5
            }
          }
        },
        "glm-5.1": {
          "id": "glm-5.1",
          "name": "GLM-5.1",
          "description": "Flagship GLM model for hybrid reasoning, coding, and agentic engineering",
          "family": "glm",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-04-07",
          "last_updated": "2026-04-07",
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
            "context": 202752,
            "output": 32768
          },
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          }
        },
        "mimo-v2.5-pro": {
          "id": "mimo-v2.5-pro",
          "name": "MiMo V2.5 Pro",
          "description": "MiMo pro model for strong multimodal reasoning and agent execution",
          "family": "mimo-v2.5-pro",
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
          "cost": {
            "input": 0.435,
            "output": 0.87,
            "cache_read": 0.003625
          }
        },
        "hy3": {
          "id": "hy3",
          "name": "Hy3 (8x usage)",
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
            "output": 64000
          },
          "cost": {
            "input": 0.0175,
            "output": 0.0725,
            "cache_read": 0.004375
          }
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.1,
            "output": 0.2,
            "cache_read": 0.002
          }
        },
        "kimi-k2.6": {
          "id": "kimi-k2.6",
          "name": "Kimi K2.6",
          "description": "Kimi multimodal agent model for visual understanding, coding, and planning",
          "family": "kimi-k2",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2026-04-21",
          "last_updated": "2026-04-21",
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
            "output": 65536
          },
          "cost": {
            "input": 0.95,
            "output": 4,
            "cache_read": 0.16
          }
        }
      }
    },
    "opencode": {
      "id": "opencode",
      "env": [
        "OPENCODE_API_KEY"
      ],
      "npm": "@ai-sdk/openai-compatible",
      "api": "https://opencode.ai/zen/v1",
      "name": "OpenCode Zen",
      "doc": "https://opencode.ai/docs/zen",
      "models": {
        "gemini-3-pro": {
          "id": "gemini-3-pro",
          "name": "Gemini 3 Pro",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "gemini-pro",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2025-11-18",
          "last_updated": "2025-11-18",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 2,
            "output": 12,
            "cache_read": 0.2,
            "tiers": [
              {
                "input": 4,
                "output": 18,
                "cache_read": 0.4,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 4,
              "output": 18,
              "cache_read": 0.4
            }
          }
        },
        "claude-opus-4-7": {
          "id": "claude-opus-4-7",
          "name": "Claude Opus 4.7",
          "description": "Flagship Claude model for deep reasoning, coding, and long-horizon agents",
          "family": "claude-opus",
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
          "temperature": false,
          "knowledge": "2026-01-31",
          "release_date": "2026-04-16",
          "last_updated": "2026-04-16",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 5,
            "output": 25,
            "cache_read": 0.5,
            "cache_write": 6.25
          }
        },
        "glm-4.6": {
          "id": "glm-4.6",
          "name": "GLM-4.6",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "glm",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2025-09-30",
          "last_updated": "2025-09-30",
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
          "cost": {
            "input": 0.6,
            "output": 2.2,
            "cache_read": 0.1
          }
        },
        "ling-3.0-flash-free": {
          "id": "ling-3.0-flash-free",
          "name": "Ling-3.0-flash Free",
          "description": "Efficient model for low-latency assistance, extraction, and routine automation",
          "family": "ling",
          "attachment": false,
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
          "structured_output": false,
          "temperature": true,
          "release_date": "2026-07-23",
          "last_updated": "2026-07-23",
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
            "output": 32768
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "laguna-s-2.1-free": {
          "id": "laguna-s-2.1-free",
          "name": "Laguna S 2.1 Free",
          "description": "Agentic coding model from Poolside in the XS size class for local deployment",
          "family": "laguna",
          "attachment": false,
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
          "structured_output": false,
          "temperature": true,
          "release_date": "2026-07-21",
          "last_updated": "2026-07-21",
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
            "output": 32000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "nemotron-3.5-lightning-free": {
          "id": "nemotron-3.5-lightning-free",
          "name": "Nemotron 3.5 Lightning Free",
          "description": "Fast NVIDIA Nemotron MoE for reliable agentic tasks across enterprise workloads",
          "family": "nemotron-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-08-11",
          "last_updated": "2026-08-11",
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
            "context": 262144,
            "output": 262144
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
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
          "cost": {
            "input": 0.95,
            "output": 4,
            "cache_read": 0.19
          }
        },
        "ring-2.6-1t-free": {
          "id": "ring-2.6-1t-free",
          "name": "Ring 2.6 1T Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "ring-1t-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2025-06",
          "release_date": "2026-05-08",
          "last_updated": "2026-05-08",
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
            "context": 262000,
            "output": 66000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0
          }
        },
        "nemotron-3-super-free": {
          "id": "nemotron-3-super-free",
          "name": "Nemotron 3 Super Free",
          "description": "Nemotron middle tier for collaborative agents and high-volume reasoning workloads",
          "family": "nemotron-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2026-02",
          "release_date": "2026-03-11",
          "last_updated": "2026-03-11",
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
            "output": 128000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "gpt-5-nano": {
          "id": "gpt-5-nano",
          "name": "GPT-5 Nano",
          "description": "Compact GPT model for low-latency assistance and high-volume workloads",
          "family": "gpt-nano",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2024-05-30",
          "release_date": "2025-08-07",
          "last_updated": "2025-08-07",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.05,
            "output": 0.4,
            "cache_read": 0.005
          }
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
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3
          }
        },
        "gpt-5.5-pro": {
          "id": "gpt-5.5-pro",
          "name": "GPT-5.5 Pro",
          "description": "Frontier GPT model for professional reasoning, coding, and multimodal work",
          "family": "gpt-pro",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "medium",
                "high",
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": false,
          "temperature": false,
          "knowledge": "2025-12-01",
          "release_date": "2026-04-24",
          "last_updated": "2026-04-24",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 30,
            "output": 180,
            "cache_read": 30
          }
        },
        "glm-4.7": {
          "id": "glm-4.7",
          "name": "GLM-4.7",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "glm",
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
          "knowledge": "2025-04",
          "release_date": "2025-12-22",
          "last_updated": "2025-12-22",
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
          "cost": {
            "input": 0.6,
            "output": 2.2,
            "cache_read": 0.1
          }
        },
        "deepseek-v4-flash": {
          "id": "deepseek-v4-flash",
          "name": "DeepSeek V4 Flash",
          "description": "Official DeepSeek V4 Flash release with enhanced agentic capabilities and integrated DSpark speculative decoding",
          "family": "deepseek-flash",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
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
          "release_date": "2026-07-31",
          "last_updated": "2026-07-31",
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
          "cost": {
            "input": 0.14,
            "output": 0.28,
            "cache_read": 0.028
          }
        },
        "kimi-k2.5-free": {
          "id": "kimi-k2.5-free",
          "name": "Kimi K2.5 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "kimi-free",
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
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2026-01-27",
          "last_updated": "2026-01-27",
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
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "north-mini-code-free": {
          "id": "north-mini-code-free",
          "name": "North Mini Code Free",
          "description": "Cohere coding model for practical software engineering and agentic edits",
          "family": "north-free",
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
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-09-23",
          "release_date": "2026-06-09",
          "last_updated": "2026-06-09",
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
            "output": 64000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0
          }
        },
        "deepseek-v4-flash-free": {
          "id": "deepseek-v4-flash-free",
          "name": "DeepSeek V4 Flash Free",
          "description": "Official DeepSeek V4 Flash release with enhanced agentic capabilities and integrated DSpark speculative decoding",
          "family": "deepseek-flash",
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
          "knowledge": "2025-05",
          "release_date": "2026-07-31",
          "last_updated": "2026-07-31",
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
            "context": 200000,
            "output": 128000
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "minimax-m3-free": {
          "id": "minimax-m3-free",
          "name": "MiniMax-M3 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "minimax-m3-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-05-31",
          "last_updated": "2026-05-31",
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
            "context": 200000,
            "output": 32000
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "claude-opus-4-8": {
          "id": "claude-opus-4-8",
          "name": "Claude Opus 4.8",
          "description": "Top Claude Opus tier for the hardest reasoning, coding, and long-horizon agents",
          "family": "claude-opus",
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
          "temperature": false,
          "knowledge": "2026-01",
          "release_date": "2026-05-28",
          "last_updated": "2026-05-28",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 5,
            "output": 25,
            "cache_read": 0.5,
            "cache_write": 6.25
          }
        },
        "gemini-3.5-flash-lite": {
          "id": "gemini-3.5-flash-lite",
          "name": "Gemini 3.5 Flash Lite",
          "description": "Fast Gemini model balancing multimodal reasoning, tool use, and cost",
          "family": "gemini-flash-lite",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2026-03",
          "release_date": "2026-07-21",
          "last_updated": "2026-07-21",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 0.3,
            "output": 2.5,
            "cache_read": 0.03
          }
        },
        "gemini-3.1-pro": {
          "id": "gemini-3.1-pro",
          "name": "Gemini 3.1 Pro Preview",
          "description": "Advanced Gemini model for complex reasoning, coding, and multimodal analysis",
          "family": "gemini-pro",
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
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-02-19",
          "last_updated": "2026-02-19",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 2,
            "output": 12,
            "cache_read": 0.2,
            "tiers": [
              {
                "input": 4,
                "output": 18,
                "cache_read": 0.4,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 4,
              "output": 18,
              "cache_read": 0.4
            }
          }
        },
        "gpt-5.6-sol": {
          "id": "gpt-5.6-sol",
          "name": "GPT-5.6 Sol (50% Off)",
          "description": "Frontier GPT-5.6 model for complex professional work, coding, and agentic workflows",
          "family": "gpt-sol",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 2.5,
            "output": 15,
            "cache_read": 0.25,
            "cache_write": 3.125,
            "tiers": [
              {
                "input": 5,
                "output": 22.5,
                "cache_read": 0.5,
                "cache_write": 6.25,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 5,
              "output": 22.5,
              "cache_read": 0.5,
              "cache_write": 6.25
            }
          }
        },
        "grok-4.6": {
          "id": "grok-4.6",
          "name": "Grok 4.6",
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
          "knowledge": "2026-02-01",
          "release_date": "2026-08-12",
          "last_updated": "2026-08-12",
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
            "context": 500000,
            "output": 500000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
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
          }
        },
        "gpt-5.4-pro": {
          "id": "gpt-5.4-pro",
          "name": "GPT-5.4 Pro",
          "description": "Frontier GPT model for professional reasoning, coding, and multimodal work",
          "family": "gpt-pro",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "medium",
                "high",
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": false,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-03-05",
          "last_updated": "2026-03-05",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 30,
            "output": 180,
            "cache_read": 30
          }
        },
        "nemotron-3-ultra-free": {
          "id": "nemotron-3-ultra-free",
          "name": "Nemotron 3 Ultra Free",
          "description": "Largest Nemotron 3 model for maximum open-weight reasoning and agent accuracy",
          "family": "nemotron-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2026-02",
          "release_date": "2026-06-04",
          "last_updated": "2026-06-04",
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
            "output": 128000
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "grok-4.5": {
          "id": "grok-4.5",
          "name": "Grok 4.5",
          "description": "xAI's Grok model for chat, coding, agentic tools, and lower hallucination risk",
          "family": "grok",
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
          "temperature": true,
          "release_date": "2026-07-08",
          "last_updated": "2026-07-08",
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
            "context": 500000,
            "output": 500000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
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
          }
        },
        "gpt-5": {
          "id": "gpt-5",
          "name": "GPT-5",
          "description": "GPT model for general reasoning, writing, coding, and tool-assisted tasks",
          "family": "gpt",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2024-09-30",
          "release_date": "2025-08-07",
          "last_updated": "2025-08-07",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.07,
            "output": 8.5,
            "cache_read": 0.107
          }
        },
        "claude-opus-4-1": {
          "id": "claude-opus-4-1",
          "name": "Claude Opus 4.1",
          "description": "Flagship Claude model for deep reasoning, coding, and long-horizon agents",
          "family": "claude-opus",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-03-31",
          "release_date": "2025-08-05",
          "last_updated": "2025-08-05",
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
            "context": 200000,
            "output": 32000
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 15,
            "output": 75,
            "cache_read": 1.5,
            "cache_write": 18.75
          }
        },
        "deepseek-v4-pro": {
          "id": "deepseek-v4-pro",
          "name": "DeepSeek V4 Pro",
          "description": "Open MoE flagship with million-token context for coding and long agent runs",
          "family": "deepseek-thinking",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
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
          "cost": {
            "input": 1.74,
            "output": 3.84,
            "cache_read": 0.145
          }
        },
        "claude-sonnet-5": {
          "id": "claude-sonnet-5",
          "name": "Claude Sonnet 5",
          "description": "Everyday Claude agent model for coding, planning, browsing, and general work",
          "family": "claude-sonnet",
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
          "temperature": false,
          "knowledge": "2026-01-31",
          "release_date": "2026-06-30",
          "last_updated": "2026-06-30",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 2,
            "output": 10,
            "cache_read": 0.2,
            "cache_write": 2.5
          }
        },
        "glm-4.7-free": {
          "id": "glm-4.7-free",
          "name": "GLM-4.7 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "glm-free",
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
          "knowledge": "2025-04",
          "release_date": "2025-12-22",
          "last_updated": "2025-12-22",
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
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "qwen3.5-plus": {
          "id": "qwen3.5-plus",
          "name": "Qwen3.5 Plus",
          "description": "Multimodal reasoning model for visual analysis, planning, and tool use",
          "family": "qwen3.5",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 81920
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-02-16",
          "last_updated": "2026-02-16",
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
            "context": 262144,
            "output": 65536
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.2,
            "output": 1.2,
            "cache_read": 0.02,
            "cache_write": 0.25
          }
        },
        "trinity-large-preview-free": {
          "id": "trinity-large-preview-free",
          "name": "Trinity Large Preview",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "trinity",
          "attachment": false,
          "reasoning": false,
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-06",
          "release_date": "2026-01-27",
          "last_updated": "2026-01-28",
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
            "context": 131072,
            "output": 131072
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0
          }
        },
        "gpt-5.1-codex-mini": {
          "id": "gpt-5.1-codex-mini",
          "name": "GPT-5.1 Codex Mini",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
          "knowledge": "2024-09-30",
          "release_date": "2025-11-13",
          "last_updated": "2025-11-13",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.25,
            "output": 2,
            "cache_read": 0.025
          }
        },
        "gpt-5-codex": {
          "id": "gpt-5-codex",
          "name": "GPT-5 Codex",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
          "knowledge": "2024-09-30",
          "release_date": "2025-09-15",
          "last_updated": "2025-09-15",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.07,
            "output": 8.5,
            "cache_read": 0.107
          }
        },
        "claude-3-5-haiku": {
          "id": "claude-3-5-haiku",
          "name": "Claude Haiku 3.5",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "claude-haiku",
          "attachment": true,
          "reasoning": false,
          "tool_call": true,
          "temperature": true,
          "knowledge": "2024-07-31",
          "release_date": "2024-10-22",
          "last_updated": "2024-10-22",
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
            "context": 200000,
            "output": 8192
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.8,
            "output": 4,
            "cache_read": 0.08,
            "cache_write": 1
          }
        },
        "grok-code": {
          "id": "grok-code",
          "name": "Grok Code Fast 1",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "grok",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "release_date": "2025-08-20",
          "last_updated": "2025-08-20",
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
            "context": 256000,
            "output": 256000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
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
            "npm": "@ai-sdk/openai"
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
          }
        },
        "kimi-k2": {
          "id": "kimi-k2",
          "name": "Kimi K2",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "kimi-k2",
          "attachment": false,
          "reasoning": false,
          "tool_call": true,
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2025-09-05",
          "last_updated": "2025-09-05",
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
            "context": 262144,
            "output": 262144
          },
          "status": "deprecated",
          "cost": {
            "input": 0.4,
            "output": 2.5,
            "cache_read": 0.4
          }
        },
        "hy3-preview-free": {
          "id": "hy3-preview-free",
          "name": "Hy3 preview Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "hy3-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-06",
          "release_date": "2026-04-20",
          "last_updated": "2026-04-20",
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
            "output": 64000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "glm-5": {
          "id": "glm-5",
          "name": "GLM-5",
          "description": "Flagship GLM model for hybrid reasoning, coding, and agentic engineering",
          "family": "glm",
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
          "knowledge": "2025-04",
          "release_date": "2026-02-11",
          "last_updated": "2026-02-11",
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
          "cost": {
            "input": 1,
            "output": 3.2,
            "cache_read": 0.2
          }
        },
        "minimax-m3": {
          "id": "minimax-m3",
          "name": "MiniMax-M3",
          "description": "MiniMax multimodal model for long-context coding, perception, and agent planning",
          "family": "minimax",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
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
            "context": 512000,
            "output": 128000
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06
          }
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
          "interleaved": {
            "field": "reasoning_content"
          },
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
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06
          }
        },
        "hy3-free": {
          "id": "hy3-free",
          "name": "Hy3 Free",
          "description": "Tencent Hy reasoning model for coding, instruction following, and agent tasks",
          "family": "hy3-free",
          "attachment": false,
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
            "context": 190000,
            "output": 64000
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "gpt-5.3-codex": {
          "id": "gpt-5.3-codex",
          "name": "GPT-5.3 Codex",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-02-24",
          "last_updated": "2026-02-24",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.75,
            "output": 14,
            "cache_read": 0.175
          }
        },
        "claude-sonnet-4": {
          "id": "claude-sonnet-4",
          "name": "Claude Sonnet 4",
          "description": "Balanced Claude model for coding, analysis, agent workflows, and cost control",
          "family": "claude-sonnet",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-03-31",
          "release_date": "2025-05-22",
          "last_updated": "2025-05-22",
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
            "output": 64000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3,
            "cache_write": 3.75,
            "tiers": [
              {
                "input": 6,
                "output": 22.5,
                "cache_read": 0.6,
                "cache_write": 7.5,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 6,
              "output": 22.5,
              "cache_read": 0.6,
              "cache_write": 7.5
            }
          }
        },
        "gpt-5.3-codex-spark": {
          "id": "gpt-5.3-codex-spark",
          "name": "GPT-5.3 Codex Spark",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex-spark",
          "attachment": false,
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
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-02-12",
          "last_updated": "2026-02-12",
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
            "context": 128000,
            "input": 128000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.75,
            "output": 14,
            "cache_read": 0.175
          }
        },
        "muse-spark-1.2-contributor-free": {
          "id": "muse-spark-1.2-contributor-free",
          "name": "Muse Spark 1.2 Free",
          "description": "Muse Spark 1.2 is a coding-focused update to Muse Spark 1.1 with improvements in code generation, complex debugging, codebase understanding, and end-to-end developer workflows.",
          "family": "muse-free",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "gpt-5.2": {
          "id": "gpt-5.2",
          "name": "GPT-5.2",
          "description": "GPT model for general reasoning, writing, coding, and tool-assisted tasks",
          "family": "gpt",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2025-12-11",
          "last_updated": "2025-12-11",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.75,
            "output": 14,
            "cache_read": 0.175
          }
        },
        "gemini-3.5-flash": {
          "id": "gemini-3.5-flash",
          "name": "Gemini 3.5 Flash",
          "description": "Fast Gemini model balancing multimodal reasoning, tool use, and cost",
          "family": "gemini-flash",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-05-19",
          "last_updated": "2026-05-19",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 1.5,
            "output": 9,
            "cache_read": 0.15,
            "input_audio": 1.5
          }
        },
        "ling-2.6-flash-free": {
          "id": "ling-2.6-flash-free",
          "name": "Ling 2.6 Flash Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "ling-flash-free",
          "attachment": false,
          "reasoning": false,
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-06",
          "release_date": "2026-04-21",
          "last_updated": "2026-04-21",
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
            "context": 262100,
            "output": 32800
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0
          }
        },
        "claude-opus-4-5": {
          "id": "claude-opus-4-5",
          "name": "Claude Opus 4.5",
          "description": "Flagship Claude model for deep reasoning, coding, and long-horizon agents",
          "family": "claude-opus",
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
            },
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-03-31",
          "release_date": "2025-11-24",
          "last_updated": "2025-11-24",
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
            "context": 200000,
            "output": 64000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 5,
            "output": 25,
            "cache_read": 0.5,
            "cache_write": 6.25
          }
        },
        "gpt-5.4-mini": {
          "id": "gpt-5.4-mini",
          "name": "GPT-5.4 Mini",
          "description": "Compact GPT model for low-latency assistance and high-volume workloads",
          "family": "gpt-mini",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-03-17",
          "last_updated": "2026-03-17",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.75,
            "output": 4.5,
            "cache_read": 0.075
          }
        },
        "claude-sonnet-4-6": {
          "id": "claude-sonnet-4-6",
          "name": "Claude Sonnet 4.6",
          "description": "Balanced Claude model for coding, analysis, agent workflows, and cost control",
          "family": "claude-sonnet",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "max"
              ]
            },
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "interleaved": true,
          "temperature": true,
          "knowledge": "2025-08-31",
          "release_date": "2026-02-17",
          "last_updated": "2026-02-17",
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
            "output": 64000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3,
            "cache_write": 3.75
          }
        },
        "mimo-v2-pro-free": {
          "id": "mimo-v2-pro-free",
          "name": "MiMo V2 Pro Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "mimo-pro-free",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
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
            "context": 1048576,
            "output": 64000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "qwen3-coder": {
          "id": "qwen3-coder",
          "name": "Qwen3 Coder",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "qwen",
          "attachment": false,
          "reasoning": false,
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2025-07-23",
          "last_updated": "2025-07-23",
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
            "context": 262144,
            "output": 65536
          },
          "status": "deprecated",
          "cost": {
            "input": 0.45,
            "output": 1.8
          }
        },
        "muse-spark-1.2": {
          "id": "muse-spark-1.2",
          "name": "Muse Spark 1.2",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.25,
            "output": 4.25,
            "cache_read": 0.15
          }
        },
        "gpt-5.5": {
          "id": "gpt-5.5",
          "name": "GPT-5.5",
          "description": "Default frontier GPT for coding, computer use, research, and knowledge work",
          "family": "gpt",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-12-01",
          "release_date": "2026-04-23",
          "last_updated": "2026-04-23",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 5,
            "output": 30,
            "cache_read": 0.5,
            "tiers": [
              {
                "input": 10,
                "output": 45,
                "cache_read": 1,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 10,
              "output": 45,
              "cache_read": 1
            }
          }
        },
        "mimo-v2-flash-free": {
          "id": "mimo-v2-flash-free",
          "name": "MiMo V2 Flash Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "mimo-flash-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2025-12-16",
          "last_updated": "2025-12-16",
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
            "context": 262144,
            "output": 65536
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "minimax-m2.5-free": {
          "id": "minimax-m2.5-free",
          "name": "MiniMax-M2.5 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "minimax-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-02-12",
          "last_updated": "2026-02-12",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "glm-5-free": {
          "id": "glm-5-free",
          "name": "GLM-5 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "glm-free",
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
          "knowledge": "2025-04",
          "release_date": "2026-02-11",
          "last_updated": "2026-02-11",
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
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "kimi-k2.5": {
          "id": "kimi-k2.5",
          "name": "Kimi K2.5",
          "description": "Kimi multimodal agent model for visual understanding, coding, and planning",
          "family": "kimi-k2",
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
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2026-01-27",
          "last_updated": "2026-01-27",
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
            "output": 65536
          },
          "cost": {
            "input": 0.6,
            "output": 3,
            "cache_read": 0.08
          }
        },
        "gpt-5.2-codex": {
          "id": "gpt-5.2-codex",
          "name": "GPT-5.2 Codex",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-01-14",
          "last_updated": "2026-01-14",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.75,
            "output": 14,
            "cache_read": 0.175
          }
        },
        "claude-sonnet-4-5": {
          "id": "claude-sonnet-4-5",
          "name": "Claude Sonnet 4.5",
          "description": "Balanced Claude model for coding, analysis, agent workflows, and cost control",
          "family": "claude-sonnet",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "interleaved": true,
          "temperature": true,
          "knowledge": "2025-07-31",
          "release_date": "2025-09-29",
          "last_updated": "2025-09-29",
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
            "output": 64000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 3,
            "output": 15,
            "cache_read": 0.3,
            "cache_write": 3.75,
            "tiers": [
              {
                "input": 6,
                "output": 22.5,
                "cache_read": 0.6,
                "cache_write": 7.5,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 6,
              "output": 22.5,
              "cache_read": 0.6,
              "cache_write": 7.5
            }
          }
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
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          }
        },
        "qwen3.6-plus-free": {
          "id": "qwen3.6-plus-free",
          "name": "Qwen3.6 Plus Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "qwen-free",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 81920
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-04-02",
          "last_updated": "2026-04-02",
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
            "context": 262144,
            "output": 65536
          },
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "mimo-v2.5-free": {
          "id": "mimo-v2.5-free",
          "name": "MiMo V2.5 Free",
          "description": "MiMo omni model for text, image, video, audio, and agents",
          "family": "mimo-v2.5-free",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2026-04-24",
          "last_updated": "2026-04-24",
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
            "context": 200000,
            "output": 32000
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "minimax-m2.5": {
          "id": "minimax-m2.5",
          "name": "MiniMax-M2.5",
          "description": "MiniMax model for chat, coding, office work, and agentic tasks",
          "family": "minimax",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2026-02-12",
          "last_updated": "2026-02-12",
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
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06
          }
        },
        "gemini-3.6-flash": {
          "id": "gemini-3.6-flash",
          "name": "Gemini 3.6 Flash",
          "description": "Fast Gemini model balancing multimodal reasoning, tool use, and cost",
          "family": "gemini-flash",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2026-03",
          "release_date": "2026-07-21",
          "last_updated": "2026-07-21",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 1.5,
            "output": 7.5,
            "cache_read": 0.15,
            "input_audio": 1.5
          }
        },
        "minimax-m2.1-free": {
          "id": "minimax-m2.1-free",
          "name": "MiniMax-M2.1 Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "minimax-free",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2025-12-23",
          "last_updated": "2025-12-23",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "gpt-5.6-terra": {
          "id": "gpt-5.6-terra",
          "name": "GPT-5.6 Terra",
          "description": "Balanced GPT-5.6 model for capable, cost-efficient everyday work",
          "family": "gpt-terra",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 2.5,
            "output": 15,
            "cache_read": 0.25,
            "cache_write": 3.125,
            "tiers": [
              {
                "input": 5,
                "output": 22.5,
                "cache_read": 0.5,
                "cache_write": 6.25,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 5,
              "output": 22.5,
              "cache_read": 0.5,
              "cache_write": 6.25
            }
          }
        },
        "gemini-3-flash": {
          "id": "gemini-3-flash",
          "name": "Gemini 3 Flash",
          "description": "Fast Gemini model balancing multimodal reasoning, tool use, and cost",
          "family": "gemini-flash",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "minimal",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2025-12-17",
          "last_updated": "2025-12-17",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 0.5,
            "output": 3,
            "cache_read": 0.05
          }
        },
        "gpt-5.4": {
          "id": "gpt-5.4",
          "name": "GPT-5.4",
          "description": "Agent-ready GPT for coding and computer-use workflows at a lower cost",
          "family": "gpt",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-03-05",
          "last_updated": "2026-03-05",
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 2.5,
            "output": 15,
            "cache_read": 0.25,
            "tiers": [
              {
                "input": 5,
                "output": 22.5,
                "cache_read": 0.5,
                "tier": {
                  "type": "context",
                  "size": 272000
                }
              }
            ],
            "context_over_200k": {
              "input": 5,
              "output": 22.5,
              "cache_read": 0.5
            }
          }
        },
        "qwen3.6-plus": {
          "id": "qwen3.6-plus",
          "name": "Qwen3.6 Plus",
          "description": "Multimodal reasoning model for visual analysis, planning, and tool use",
          "family": "qwen3.6",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "toggle"
            },
            {
              "type": "budget_tokens",
              "max": 81920
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-04",
          "release_date": "2026-04-02",
          "last_updated": "2026-04-02",
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
            "context": 262144,
            "output": 65536
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.5,
            "output": 3,
            "cache_read": 0.05,
            "cache_write": 0.625
          }
        },
        "ling-3.0-tiny-free": {
          "id": "ling-3.0-tiny-free",
          "name": "Ling-3.0-tiny Free",
          "description": "Compact MoE model for responsive agents, instruction following, and multi-turn conversations",
          "family": "ling",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "structured_output": false,
          "temperature": true,
          "release_date": "2026-08-06",
          "last_updated": "2026-08-06",
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
            "output": 32768
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0
          }
        },
        "claude-fable-5": {
          "id": "claude-fable-5",
          "name": "Claude Fable 5",
          "description": "Claude model for creative writing, analysis, and controlled agent workflows",
          "family": "claude-fable",
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
          "temperature": false,
          "knowledge": "2026-01-31",
          "release_date": "2026-06-09",
          "last_updated": "2026-06-09",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 10,
            "output": 50,
            "cache_read": 1,
            "cache_write": 12.5
          }
        },
        "glm-5.1": {
          "id": "glm-5.1",
          "name": "GLM-5.1",
          "description": "Flagship GLM model for hybrid reasoning, coding, and agentic engineering",
          "family": "glm",
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
          "knowledge": "2025-04",
          "release_date": "2026-04-07",
          "last_updated": "2026-04-07",
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
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
          }
        },
        "big-pickle": {
          "id": "big-pickle",
          "name": "Big Pickle",
          "description": "Reasoning model for deliberate analysis, multi-step problem solving, and tool use",
          "family": "big-pickle",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2025-10-17",
          "last_updated": "2025-10-17",
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
            "context": 200000,
            "input": 160000,
            "output": 32000
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
        },
        "claude-haiku-4-5": {
          "id": "claude-haiku-4-5",
          "name": "Claude Haiku 4.5",
          "description": "Fast Claude model for responsive assistance, classification, and lightweight agents",
          "family": "claude-haiku",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-02-28",
          "release_date": "2025-10-15",
          "last_updated": "2025-10-15",
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
            "context": 200000,
            "output": 64000
          },
          "provider": {
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 1,
            "output": 5,
            "cache_read": 0.1,
            "cache_write": 1.25
          }
        },
        "gpt-5.1-codex-max": {
          "id": "gpt-5.1-codex-max",
          "name": "GPT-5.1 Codex Max",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
          "temperature": false,
          "knowledge": "2024-09-30",
          "release_date": "2025-11-13",
          "last_updated": "2025-11-13",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.25,
            "output": 10,
            "cache_read": 0.125
          }
        },
        "claude-opus-4-6": {
          "id": "claude-opus-4-6",
          "name": "Claude Opus 4.6",
          "description": "High-end Claude for difficult coding, planning, and slower expert reasoning",
          "family": "claude-opus",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "low",
                "medium",
                "high",
                "max"
              ]
            },
            {
              "type": "budget_tokens",
              "min": 1024
            }
          ],
          "tool_call": true,
          "temperature": true,
          "knowledge": "2025-05-31",
          "release_date": "2026-02-05",
          "last_updated": "2026-03-13",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 5,
            "output": 25,
            "cache_read": 0.5,
            "cache_write": 6.25
          }
        },
        "gpt-5.1-codex": {
          "id": "gpt-5.1-codex",
          "name": "GPT-5.1 Codex",
          "description": "Coding-optimized GPT model for repository edits, reviews, and agentic software work",
          "family": "gpt-codex",
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
          "knowledge": "2024-09-30",
          "release_date": "2025-11-13",
          "last_updated": "2025-11-13",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.07,
            "output": 8.5,
            "cache_read": 0.107
          }
        },
        "claude-opus-5": {
          "id": "claude-opus-5",
          "name": "Claude Opus 5",
          "description": "Strongest Claude Opus model for coding, agents, and professional work",
          "family": "claude-opus",
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
          "temperature": false,
          "knowledge": "2026-05",
          "release_date": "2026-07-24",
          "last_updated": "2026-07-24",
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 5,
            "output": 25,
            "cache_read": 0.5,
            "cache_write": 6.25
          }
        },
        "mimo-v2-omni-free": {
          "id": "mimo-v2-omni-free",
          "name": "MiMo V2 Omni Free",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "mimo-omni-free",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-12",
          "release_date": "2026-03-18",
          "last_updated": "2026-03-18",
          "modalities": {
            "input": [
              "text",
              "image",
              "audio",
              "pdf"
            ],
            "output": [
              "text"
            ]
          },
          "open_weights": true,
          "limit": {
            "context": 262144,
            "output": 64000
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "grok-build-0.1": {
          "id": "grok-build-0.1",
          "name": "Grok Build 0.1",
          "description": "Fast Grok coding model tuned for agentic engineering and iterative edits",
          "family": "grok-build",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-04-16",
          "last_updated": "2026-04-16",
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
            "context": 256000,
            "output": 256000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1,
            "output": 2,
            "cache_read": 0.2
          }
        },
        "minimax-m2.1": {
          "id": "minimax-m2.1",
          "name": "MiniMax-M2.1",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "minimax",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2025-01",
          "release_date": "2025-12-23",
          "last_updated": "2025-12-23",
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
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.1
          }
        },
        "gemini-3.7-flash": {
          "id": "gemini-3.7-flash",
          "name": "Gemini 3.7 Flash",
          "description": "High-efficiency Gemini model for agentic workflows, coding, and multimodal reasoning",
          "family": "gemini-flash",
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
          "temperature": true,
          "knowledge": "2026-03",
          "release_date": "2026-08-13",
          "last_updated": "2026-08-13",
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
            "npm": "@ai-sdk/google"
          },
          "cost": {
            "input": 1.5,
            "output": 7.5,
            "cache_read": 0.15,
            "input_audio": 1.5
          }
        },
        "kimi-k2-thinking": {
          "id": "kimi-k2-thinking",
          "name": "Kimi K2 Thinking",
          "description": "Legacy model retained for compatibility with older integrations",
          "family": "kimi-thinking",
          "attachment": false,
          "reasoning": true,
          "reasoning_options": [],
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2025-09-05",
          "last_updated": "2025-09-05",
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
            "context": 262144,
            "output": 262144
          },
          "status": "deprecated",
          "cost": {
            "input": 0.4,
            "output": 2.5,
            "cache_read": 0.4
          }
        },
        "gpt-5.4-nano": {
          "id": "gpt-5.4-nano",
          "name": "GPT-5.4 Nano",
          "description": "Compact GPT model for low-latency assistance and high-volume workloads",
          "family": "gpt-nano",
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
                "xhigh"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2025-08-31",
          "release_date": "2026-03-17",
          "last_updated": "2026-03-17",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.2,
            "output": 1.25,
            "cache_read": 0.02
          }
        },
        "kimi-k2.6": {
          "id": "kimi-k2.6",
          "name": "Kimi K2.6",
          "description": "Kimi multimodal agent model for visual understanding, coding, and planning",
          "family": "kimi-k2",
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
          "temperature": true,
          "knowledge": "2024-10",
          "release_date": "2026-04-21",
          "last_updated": "2026-04-21",
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
            "output": 65536
          },
          "cost": {
            "input": 0.95,
            "output": 4,
            "cache_read": 0.16
          }
        },
        "longcat-2.0-free": {
          "id": "longcat-2.0-free",
          "name": "LongCat-2.0 Free",
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
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
        },
        "gpt-5.1": {
          "id": "gpt-5.1",
          "name": "GPT-5.1",
          "description": "GPT model for general reasoning, writing, coding, and tool-assisted tasks",
          "family": "gpt",
          "attachment": true,
          "reasoning": true,
          "reasoning_options": [
            {
              "type": "effort",
              "values": [
                "none",
                "low",
                "medium",
                "high"
              ]
            }
          ],
          "tool_call": true,
          "structured_output": true,
          "temperature": false,
          "knowledge": "2024-09-30",
          "release_date": "2025-11-13",
          "last_updated": "2025-11-13",
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
            "context": 400000,
            "input": 272000,
            "output": 128000
          },
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 1.07,
            "output": 8.5,
            "cache_read": 0.107
          }
        }
      }
    }
  }

} as unknown as HardcodedCatalogData;
