# @ag2b/core

## 0.0.2

### Patch Changes

- [`0dae2d0`](https://github.com/ag2b/ag2b/commit/0dae2d0c02d7ebb15d0e6d4a42ee19b858ef9a95) - Stream tool calls as they arrive.

  Add `agent_tool_call_delta` — a new agent event emitted for each tool-call chunk during `chatStream`, and once per call
  (carrying the full arguments) under `chat` with `onEvent`. Lets a UI render a tool-call badge the moment a call starts streaming,
  instead of waiting for the turn to commit to history.

  `useAg2bChatStream`'s `pendingMessage` now surfaces in-flight tool calls via `calls`; streamed arguments parse best-effort,
  showing `{}` until the call finishes streaming.
