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
 * Snapshot taken from the official models.dev catalog on 2026-09-14.
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
          "open_weights": false,
          "limit": {
            "context": 1000000,
            "output": 131072
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.006
          }
        },
        "deepseek-v4-flash-vision-exp": {
          "id": "deepseek-v4-flash-vision-exp",
          "name": "DeepSeek V4 Flash Vision Exp",
          "description": "Experimental multimodal DeepSeek V4 Flash model for image understanding, coding, and agentic work",
          "family": "deepseek-flash",
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
          "release_date": "2026-08-21",
          "last_updated": "2026-08-21",
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
            "output": 384000
          },
          "cost": {
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.003
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
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.003
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
          "status": "deprecated",
          "provider": {
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.3,
            "tiers": [
              {
                "input": 4,
                "output": 12,
                "cache_read": 0.6,
                "tier": {
                  "type": "context",
                  "size": 200000
                }
              }
            ],
            "context_over_200k": {
              "input": 4,
              "output": 12,
              "cache_read": 0.6
            }
          }
        },
        "ox-alpha-free": {
          "id": "ox-alpha-free",
          "name": "Ox Alpha Free (Unlimited)",
          "description": "Stealth reasoning model for coding, agentic tasks, and tool use",
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
          "release_date": "2026-08-21",
          "last_updated": "2026-08-21",
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
          "status": "deprecated",
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0
          }
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
          "cost": {
            "input": 0.15,
            "output": 0.6,
            "cache_read": 0.003
          }
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
          "cost": {
            "input": 0.14,
            "output": 0.58,
            "cache_read": 0.035
          }
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
          "cost": {
            "input": 0.834,
            "output": 2.501,
            "cache_read": 0.042
          }
        },
        "omen-alpha": {
          "id": "omen-alpha",
          "name": "Omen Alpha",
          "description": "oH man anothEr aLPha ModEl",
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
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "release_date": "2026-09-04",
          "last_updated": "2026-09-04",
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
            "output": 128000
          },
          "status": "deprecated",
          "cost": {
            "input": 0.2,
            "output": 0.66,
            "cache_read": 0.04
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
        "glm-5.3-flash": {
          "id": "glm-5.3-flash",
          "name": "GLM-5.3-Flash",
          "description": "Native multimodal GLM model for efficient coding and long-horizon agent tasks",
          "family": "glm",
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
              "video",
              "pdf"
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
            "input": 0.15,
            "output": 0.5,
            "cache_read": 0.03
          }
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
            "npm": "@ai-sdk/openai"
          },
          "cost": {
            "input": 0.1,
            "output": 0.2,
            "cache_read": 0.002
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
            "npm": "@ai-sdk/anthropic"
          },
          "cost": {
            "input": 0.15,
            "output": 0.47,
            "cache_read": 0.016,
            "cache_write": 0.2
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
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.25,
            "cache_write": 2.5
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
          "cost": {
            "input": 1.4,
            "output": 4.4,
            "cache_read": 0.26
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
        }
      }
    }
  }

} as unknown as HardcodedCatalogData;
