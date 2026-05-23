# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

npm workspaces + Turborepo monorepo.

```
packages/
  core/           @ag2b/core           — runtime (Agent, Tool, Scope, providers, hooks, plugins)
  react/          @ag2b/react          — React bindings (Ag2bProvider + 8 hooks)
  react-chat/     @ag2b/react-chat     — drop-in chat UI (Ag2bPopup) on top of @ag2b/react
  plugin-webmcp/  @ag2b/plugin-webmcp  — plugin: bridges agent tools to the browser WebMCP API (navigator.modelContext)
apps/
  docs/           Fumadocs (Next.js) documentation site, hosted at https://ag2b.ai
examples/
  react-board/    end-to-end demo wiring core + react + react-chat + plugin-webmcp
```

## Common commands

Run from repo root (Turborepo fans out to all workspaces):

```bash
npm run build       # build all packages (vite for libs, next build for docs)
npm run lint        # eslint all workspaces
npm run typecheck   # tsc --noEmit per workspace
npm test            # vitest run across all packages (single root config)
npm run test:watch
npm run test:coverage
```

Per-workspace (cd into `packages/core`, `packages/react`, `packages/react-chat`, `packages/plugin-webmcp`, or `apps/docs`):

```bash
npm run build
npm run typecheck
npm run test
```

Single test file or pattern:

```bash
npx vitest run packages/core/src/agent/__tests__/agent.spec.ts
npx vitest run -t "fires onChatStart"
```

Docs site specifics (`apps/docs`):

```bash
npm run typecheck   # fumadocs-mdx && next typegen && tsc --noEmit
npm run dev         # next dev (Turbopack)
```

## Toolchain

- **Build**: vite per package (lib mode, emits `dist/`) → coordinated by `turbo build`.
- **Test**: vitest, configured at `vitest.config.ts` (root) — `projects: ['packages/*']` discovers per-package configs.
- **Lint**: eslint with `notmedia-eslint-config`.
- **Commits**: commitlint with `@commitlint/config-conventional` (enforced on `commit-msg` via lefthook).
- **Pre-commit hooks** (lefthook, `lefthook.yml`): runs `typecheck → test → lint → build` piped. Don't bypass with `--no-verify` unless explicitly authorized — fix the underlying issue.
- **Releases**: `@changesets/cli` (`.changeset/` directory).
- **TS base**: `tsconfig.base.json` — `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`. Type-only imports MUST use `import type` or inline `type` keyword.

## Architecture — core runtime

`@ag2b/core` is a client-side agentic runtime. Everything orbits the **Agent** and its loop.

### The loop (read `packages/core/src/agent/agent.ts` — `Agent.loop` / `runIteration` / `executeTool`)

`agent.chat()` / `agent.chatStream()` enter a loop that ends when the LLM returns a turn with no tool calls (or something stops it). Each iteration:

1. **Build request** — history snapshot + enabled tools + scope contexts + `system`.
2. **`preRequest`** hook (interceptor — can modify request OR short-circuit with `{ response }`).
3. **Provider call** — `provider.chat()` / `provider.chatStream()`. Skipped on short-circuit.
4. **`onResponse`** hook (interceptor — can replace response).
5. **Push assistant message** to history → fires `onMessage`.
6. **If no tool calls** → `onChatDone`, return.
7. **If tool calls** → per call: `preToolCall` → handler → `onToolCallResult` / `onToolCallError` → push tool message → `onMessage`.
8. **Increment iteration**; throw `Ag2bMaxIterationsError` if >= `maxIterations` (default 20).

### Hooks (`packages/core/src/hooks/`)

Two flavors. **Observers** return `void` (logging, metrics). **Interceptors** return modified values; some short-circuit:

| Interceptor          | Short-circuit on             |
| -------------------- | ---------------------------- |
| `preRequest`         | `{ response }`               |
| `preToolCall`        | `{ result }` or `{ error }`  |
| `onResponse`         | — always drains              |
| `onToolCallResult`   | — always drains              |
| `onToolCallError`    | — always drains              |

Hooks fire in registration order, awaited one at a time. Throws propagate to the loop and fire `onChatError`. Exceptions:
- `onChatError` and `onChatAbort` — throws inside are caught and ignored.
- `onScopeRegister` / `onScopeUnregister` — fire outside the loop via `void this.#hooks.run(...)` in `Agent`'s constructor; throws become **unhandled promise rejections** by design (surfaces bugs loudly, matches what tests expect).

### Providers (`packages/core/src/provider/`)

`AbstractProvider` (sync) and `StreamableProvider` (yields `ProviderStreamChunk`). Built-ins: `OpenAiProvider` (`/v1/chat/completions` wire format), `AnthropicProvider` (`/v1/messages`).

Each provider has a `prepareRequest` hook (the **provider-level** transform, not the **agent-level** hook). The default implementation in `AbstractProvider` inlines `request.contexts` (scope contexts) into `messages` / `system` as Markdown sections. Subclasses can override to use a different encoding. Once `prepareRequest` runs, `request.contexts` stays on the request as informational metadata — `runChat` must NOT re-inline it.

### Scopes (`packages/core/src/scope/`)

A `Scope` bundles tools + an optional context resolver. Registered on the agent via `agent.scopes.register(scope)`, returns an idempotent disposer.

- **Context resolver** runs every loop iteration. Returns anything JSON-serializable. Each scope contributes a `ScopeContext` (`{ label, injection, content }`) to `request.contexts`.
- **`injection`**: `'system'` (default, cache-friendly for stable data) or `'user'` (volatile per-turn data).
- **`enabled`** predicate — gates the whole scope. When `false`, scope's tools are filtered AND its context is dropped.
- **Throws inside `context` or `enabled`** are coerced to `false` / dropped — never crash the loop.

### Tools (`packages/core/src/tool/`)

`new Tool({ name, description, parameters: ZodObject, handler, enabled? })`.

- **Handler throws don't terminate the chat.** They're caught in `executeTool` and become tool messages (with `{ error: serializedError }` payload). The LLM sees the failure and can recover.
- Validation errors (`Ag2bToolValidationError`), unknown-tool errors (`Ag2bUnknownToolError`), disabled-tool errors (`Ag2bDisabledToolError`) flow through `onToolCallError` the same way.

### Plugins (`packages/core/src/agent/plugin.ts`)

`Ag2bPlugin = (agent: Agent) => Awaitable<void | Ag2bPluginCleanup>`. Installed via `await agent.use(plugin)`, which awaits the setup function and returns the optional cleanup. Plugins typically call `agent.addHook(...)` one or more times in their body and return a cleanup that disposes those hooks plus any external resources (sockets, intervals, listeners). Async is for plugins that need setup before registering hooks (open a connection, fetch config). `@ag2b/plugin-webmcp` is the reference implementation.

### Public exports

`packages/core/src/index.ts` is the source of truth for the public API surface. If a type or class isn't exported here, it's internal.

## Architecture — React bindings

`@ag2b/react` wraps the agent for React. One component + 8 hooks (one file per hook under `packages/react/src/hooks/`).

Key design:
- **Always-fresh callbacks (latest-ref pattern)**: `useAg2bTool` / `useAg2bScope` / `useAg2bHook` use an internal `useEventCallback` to store handlers in a ref and re-read them on every invocation. Inline arrows close over reactive state without re-registering. The function identity stays stable across renders; the closure inside is always the latest one. User-facing docs surface this as "Always-fresh" (vs "Captured at mount" for props that aren't re-read — e.g. `description` / `parameters` on `useAg2bTool`, `name` / `label` / `injection` / `tools` on `useAg2bScope`).
- **State subscription**: `useAg2bHistory` / `useAg2bScopes` use `useSyncExternalStore` for concurrent-safe reactive reads (hence the **React ≥ 18** requirement).
- **Chat as state**: `useAg2bChat` / `useAg2bChatStream` manage in-flight state (`isPending`, `error`, abort handle) and auto-abort on unmount.
- **`useAg2bChatStream.pendingMessage`**: derived from events (non-null only while the latest event is a content/reasoning delta) → `null` between iterations and after `agent_chat_done`. Consumers splice with `useAg2bHistory` via `[...messages, pendingMessage].filter(Boolean)` — no duplication of the just-committed assistant turn. Replaces earlier `content` / `reasoning` return fields that had a dual-purpose lifecycle (live during deltas + persisted post-commit) and caused visible duplication windows in conversation UIs.

## Architecture — React chat UI

`@ag2b/react-chat` is a drop-in chat surface built on `@ag2b/react`. Public export is `Ag2bPopup` (a floating action button + portal-mounted panel). It reads history via `useAg2bHistory` and drives sends through an internal `useChatController` that picks `useAg2bChat` or `useAg2bChatStream` based on `mode` (`'streaming' | 'sync'`). Markdown rendering uses `react-markdown` + `remark-gfm` (peer deps). Styles ship as a separate import (`@ag2b/react-chat/styles.css`); a theme CSS file is also bundled in the entry via `import '@/styles/theme.css'`. Peer deps: `@ag2b/core`, `@ag2b/react`, `react >=18`, `react-dom >=18`, `react-markdown >=9`, `remark-gfm >=4`.

## Architecture — WebMCP plugin

`@ag2b/plugin-webmcp` exports a single factory `webmcp(): Ag2bPlugin`. On `agent.use(webmcp())`:

- No-ops if `navigator.modelContext` is unavailable (non-browser env or browser without WebMCP) — returns an empty cleanup.
- Snapshots existing scopes and registers each `Tool` with `navigator.modelContext.registerTool(...)`, passing an `AbortSignal` per tool.
- Subscribes to `onScopeRegister` / `onScopeUnregister` so later-added scopes get bridged automatically; unregistration aborts that scope's tool signals.
- The bridged `execute` checks `tool.isEnabled() && scope.isEnabled()` at call time and throws `Tool "<name>" is disabled` if either is false — this surfaces gating to the host page rather than silently dropping.
- Cleanup aborts every controller and detaches both hook listeners.

## Architecture — docs site

`apps/docs/` is Fumadocs (Next.js + MDX).

- **Content**: `content/docs/` with route groups: `(core)/`, `react/`, `vue/`. Route group `(core)` is the default `/docs/...` path; `react/` and `vue/` are separate sidebars.
- **Config**: `source.config.ts` (Zod schemas, remark/rehype plugins, Shiki themes).
- **Path aliases** (`tsconfig.json`): `@/*` → `src/*`, `collections/*` → `.source/*`.
- **`.source/`** is generated by `fumadocs-mdx` (has `// @ts-nocheck`; do not edit manually).
- **MDX components**: `src/components/mdx.tsx` wires Fumadocs UI components + custom HeroUI components.

## Conventions

- **Zod**: import from `zod/v4` (compatible with `zod@^3.25.0` and `zod@^4.0.0`). Tool `parameters` must be `z.ZodObject` — LLMs call tools with named args.
- **Error class naming**: `Ag2b*Error` (e.g., `Ag2bProviderRequestError`, `Ag2bMaxIterationsError`). Defined in `packages/core/src/errors.ts`.
- **Tool naming**: `/^[a-zA-Z0-9_-]+$/`, unique across **every** registered Scope on an agent. Collisions throw `Ag2bError` at `scopes.register()`.
- **Test files**: colocated under `__tests__/` (e.g., `packages/core/src/agent/__tests__/agent.spec.ts`).
