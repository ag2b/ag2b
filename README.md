# AG2B

> [!IMPORTANT]
> Full documentation lives at [**ag2b.ai**](https://ag2b.ai).

**AG2B** (Agent to Browser) is a client-side agentic runtime.

The agent runs where your app does — in the browser. The server's role can range from a thin LLM proxy to a layer that extends the client runtime.

> [!TIP]
> Try the [**live demo**](https://ag2b-example.vercel.app)

## What you get

Anything the user can do in your UI, the LLM can do too.

- **Agent primitives** — Tools and scopes, the building blocks of every agent.
- **Reuse your code** — Store actions, fetch wrappers, click handlers become tools.
- **Live context** — Scopes feed your current state into every turn and gates the tools.
- **End-to-end typed** — Zod validates at runtime and types your handler.
- **Own the loop** — Observe or intercept every step: **human-in-the-loop** approvals, guardrails, retries, RAG, logging — all on the client.
- **Provider-agnostic** — Swap LLM providers in one line, built-in or bring your own.
- **Extend everything** — Plugins reshape the runtime — the [WebMCP](https://ag2b.ai/docs/plugins/webmcp) plugin is one such connector.

**Framework bindings**

- **React** — Headless hooks [`@ag2b/react`](https://ag2b.ai/docs/react) to build your own chat UI, or a drop-in chat panel [`@ag2b/react-chat`](https://ag2b.ai/docs/react/packages/react-chat).
- **Vue** — Coming soon.

## Quickstart

### Install

```bash
npm i @ag2b/core zod
```

### Writing your first agent

```ts
import { Agent, OpenAiProvider, Scope, Tool } from '@ag2b/core';
import { z } from 'zod/v4';

const setBackground = new Tool({
  name: 'setBackground',
  description: 'Change the page background color.',
  parameters: z.object({ color: z.string() }),
  handler: ({ color }) => {
    document.body.style.backgroundColor = color;
  },
});

const agent = new Agent({
  provider: new OpenAiProvider({ baseURL: '/api/llm' }),
});

agent.scopes.register(new Scope({ name: 'appearance', tools: [setBackground] }));

await agent.chat('Make the page feel like a sunset.');
// → the LLM picks a color, the tool runs, the page changes.
```

## License

MIT
