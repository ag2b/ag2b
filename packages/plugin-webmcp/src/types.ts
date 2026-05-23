declare global {
  interface Navigator {
    readonly modelContext?: ModelContext;
  }

  interface ModelContext extends EventTarget {
    registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): void;
  }

  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: unknown) => Promise<unknown>;
  }

  interface ModelContextRegisterToolOptions {
    signal?: AbortSignal;
  }
}

export {};
