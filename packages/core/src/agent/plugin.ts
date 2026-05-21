import type { Agent } from '@/agent';
import type { Awaitable } from '@/types';

/**
 * Cleanup function returned by a plugin. Called to undo whatever the plugin
 * registered — typically dispatches the disposers from `agent.addHook(...)`
 * calls made inside the plugin body, plus any external resources (DB
 * connections, intervals, listeners) the plugin owns.
 */
export type Ag2bPluginCleanup = () => void;

/**
 * A plugin is a function that receives the agent and wires it up — usually by
 * calling `agent.addHook(...)` one or more times. May be sync or async (async
 * is for plugins that need to do setup before registering hooks, e.g. open a
 * connection or fetch config).
 *
 * Returning a {@link Ag2bPluginCleanup} is optional. When provided, callers
 * use it to tear the plugin down (e.g. on a React page unmount):
 *
 * ```ts
 * const cleanup = await myPlugin(agent);
 * cleanup?.();
 * ```
 */
export type Ag2bPlugin = (agent: Agent) => Awaitable<void | Ag2bPluginCleanup>;
