# @sovereign-matrix/agent-sdk

Build custom AI agents that plug into the Sovereign Matrix platform. Define your agent's personality, tools, and safety guardrails — the SDK handles model routing, prompt assembly, and execution.

## Quick Start

```typescript
import { createAgent } from "@sovereign-matrix/agent-sdk";

const agent = createAgent({
  name: "research-agent",
  description: "Searches the web and synthesizes findings",
  model: "gemini",
  systemPrompt: "You are a research assistant. Be concise and cite sources.",
  guardrails: {
    blockPII: true,
    maxInputLength: 4000,
  },
});

const result = await agent.run({
  userId: "user_123",
  input: "What are the latest developments in quantum computing?",
});

console.log(result.output);   // The agent's response
console.log(result.tokensUsed); // Token consumption
console.log(result.duration);   // Execution time in ms
```

## Adding Tools

Give your agent the ability to call external functions:

```typescript
import { createAgent, type AgentTool } from "@sovereign-matrix/agent-sdk";

const searchTool: AgentTool = {
  name: "web_search",
  description: "Search the web for real-time information",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  handler: async (input) => {
    const response = await fetch(`https://api.example.com/search?q=${input.query}`);
    const data = await response.json();
    return JSON.stringify(data.results);
  },
};

const agent = createAgent({
  name: "search-agent",
  description: "Agent with web search capabilities",
  model: "claude",
  tools: [searchTool],
});
```

## API Reference

### `createAgent(config: AgentConfig)`

Creates and registers a new agent. Returns an object with:

- `config` — The resolved agent configuration.
- `run(context: AgentContext)` — Execute the agent and get an `AgentResponse`.

### `listAgents()`

Returns an array of all registered `AgentConfig` objects.

### `getAgent(name: string)`

Returns the `AgentConfig` for the given name, or `undefined`.

### `AgentConfig`

| Field          | Type               | Required | Default     | Description                          |
| -------------- | ------------------ | -------- | ----------- | ------------------------------------ |
| `name`         | `string`           | Yes      | —           | Unique agent identifier              |
| `description`  | `string`           | Yes      | —           | What the agent does                  |
| `version`      | `string`           | No       | `"1.0.0"`   | Semantic version                     |
| `model`        | `ModelProvider`     | No       | `"gemini"`  | LLM provider to use                  |
| `systemPrompt` | `string`           | No       | —           | System prompt for every turn         |
| `tools`        | `AgentTool[]`      | No       | —           | Tools the agent can invoke           |
| `guardrails`   | `GuardrailConfig`  | No       | —           | Input validation and safety rules    |
| `maxTokens`    | `number`           | No       | —           | Max tokens for LLM response          |

### `AgentResponse`

| Field              | Type      | Description                              |
| ------------------ | --------- | ---------------------------------------- |
| `success`          | `boolean` | Whether execution completed without error |
| `output`           | `string`  | The LLM's text response                  |
| `model`            | `string`  | Which provider handled the request       |
| `tokensUsed`       | `number`  | Approximate token consumption            |
| `duration`         | `number`  | Wall-clock time in milliseconds          |
| `guardrailsPassed` | `boolean` | Whether input passed all guardrail checks |

### Supported Models

| Provider  | Key       | Notes                                |
| --------- | --------- | ------------------------------------ |
| Google    | `gemini`  | Default. Free tier available.        |
| Anthropic | `claude`  | Best for reasoning and code.         |
| NVIDIA    | `nim`     | Free open-source models via NIM.     |
| Ollama    | `ollama`  | Local inference. Zero cost.          |
| Groq      | `groq`    | Ultra-fast inference.                |

## Guardrails

Protect your agent with built-in safety checks:

```typescript
createAgent({
  name: "safe-agent",
  description: "Agent with strict guardrails",
  guardrails: {
    blockPII: true,             // Reject inputs containing emails, phones, SSNs
    maxInputLength: 2000,       // Cap input length
    allowedTopics: ["coding", "math", "science"], // Topic whitelist
  },
});
```

## Full Documentation

For guides, advanced patterns, and the REST API reference, visit:

**[sovereignmatrix.agency/docs](https://sovereignmatrix.agency/docs)**
