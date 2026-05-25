export type {
  AgentConfig,
  AgentResponse,
  ChatOptions,

  // AgentEvent Types
  AgentEvent,
  AgentChatStart,
  AgentChatDone,
  AgentChatAbort,
  AgentChatError,
  AgentContentDelta,
  AgentReasoningDelta,
  AgentReasoningEnd,
  AgentContentEnd,
  AgentToolCallDelta,
  AgentToolCallStart,
  AgentToolCallResult,
  AgentToolCallError,

  // Plugin
  Ag2bPlugin,
  Ag2bPluginCleanup,
} from '@/agent';
export { Agent, createAgent } from '@/agent';

export type {
  UserMessage,
  AssistantMessage,
  AssistantToolCall,
  ToolMessage,
  ChatMessage,
  FinishReason,
} from '@/messages';
export { assistantMessage, userMessage, toolMessage } from '@/messages';

export type {
  // AbstractProvider Types
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,

  // StreamableProvider Types
  ProviderStreamChunk,
  ProviderContentDelta,
  ProviderReasoningDelta,
  ProviderToolCallDelta,
  ProviderStreamDone,

  // OpenAI
  OpenAiProviderConfig,

  // Anthropic
  AnthropicProviderConfig,
} from '@/provider';
export {
  AbstractProvider,
  StreamableProvider,
  OpenAiProvider,
  AnthropicProvider,
} from '@/provider';

export { History } from '@/history';

export type { ContextInjectionStrategy, ScopeContext, ScopeConfig } from '@/scope';
export { Scope } from '@/scope';

export type { ToolConfig, ToolHandlerReturn } from '@/tool';
export { Tool } from '@/tool';

export type {
  AgentHooks,

  // Observers Contexts
  OnChatStartCtx,
  OnChatDoneCtx,
  OnChatAbortCtx,
  OnChatErrorCtx,
  OnMessageCtx,
  OnScopeRegisterCtx,
  OnScopeUnregisterCtx,

  // Interceptors Contexts
  PreRequestCtx,
  PreRequestReturn,
  PreToolCallCtx,
  PreToolCallReturn,
  OnResponseCtx,
  OnResponseReturn,
  OnToolCallResultCtx,
  OnToolCallResultReturn,
  OnToolCallErrorCtx,
  OnToolCallErrorReturn,
} from '@/hooks';

export type { Awaitable } from '@/types';

export {
  Ag2bError,
  Ag2bMaxIterationsError,
  Ag2bProviderRequestError,
  Ag2bProviderResponseError,
  Ag2bToolValidationError,
  Ag2bDisabledToolError,
  Ag2bUnknownToolError,
} from '@/errors';
