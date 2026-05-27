# react-board

End-to-end demo wiring `@ag2b/core`, `@ag2b/react`, `@ag2b/react-chat`, and `@ag2b/plugin-webmcp` together — a drag-and-drop board with an in-app agent.

## Run locally

From the repo root:

```bash
npm ci           # install all workspace dependencies
npm run build    # build the @ag2b/* packages the example consumes
```

Then start the dev server:

```bash
npm run dev -w react-board
```

## Configure a provider

No `.env` is needed — pick a provider, base URL, and API key from the in-app settings modal at runtime.
