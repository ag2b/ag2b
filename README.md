# AG2B

**AG2B** (Agent to Browser) is a client-side agentic runtime.

The agent runs where your app does — in the browser. The server's role can range from a thin LLM proxy to a layer that extends the client runtime.

> [!WARNING]
> AG2B is under active development — the public API can shift between minor releases. Check release notes before upgrading.

> [!IMPORTANT]
> Full documentation lives at [**ag2b.ai**](https://ag2b.ai).

## What you get

🧩 **Agent primitives** — Building blocks that live next to your components and stores.\
🛡️ **End-to-end typed tools** — Zod schemas validate at runtime and type your handler.\
🔄 **Open lifecycle** — Observe or intercept every boundary in the loop.\
🔌 **Provider-agnostic** — Swap LLM providers with one line — built-in or your own.\
📦 **Plain TypeScript core** — No framework lock-in. Drop it into anything.\
🧱 **Framework bindings** — Per-framework bindings.

## Packages

| Package | What it ships |
|---|---|
| [`@ag2b/core`](./packages/core) | The core - runtime and primitives |
| [`@ag2b/react`](./packages/react) | AG2B bindings for React |

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
