/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as constants from "../constants.js";
import type * as http from "../http.js";
import type * as lib_extractTextContent from "../lib/extractTextContent.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as playground from "../playground.js";
import type * as private_contactSessions from "../private/contactSessions.js";
import type * as private_conversations from "../private/conversations.js";
import type * as private_files from "../private/files.js";
import type * as private_messages from "../private/messages.js";
import type * as private_plugins from "../private/plugins.js";
import type * as private_secrets from "../private/secrets.js";
import type * as private_vapi from "../private/vapi.js";
import type * as private_widgetSettings from "../private/widgetSettings.js";
import type * as public_contactSessions from "../public/contactSessions.js";
import type * as public_conversations from "../public/conversations.js";
import type * as public_messages from "../public/messages.js";
import type * as public_organizations from "../public/organizations.js";
import type * as public_secrets from "../public/secrets.js";
import type * as public_widgetSettings from "../public/widgetSettings.js";
import type * as system_ai_agents_supportAgent from "../system/ai/agents/supportAgent.js";
import type * as system_ai_constants from "../system/ai/constants.js";
import type * as system_ai_rag from "../system/ai/rag.js";
import type * as system_ai_tools_escalateConversation from "../system/ai/tools/escalateConversation.js";
import type * as system_ai_tools_resolveConversation from "../system/ai/tools/resolveConversation.js";
import type * as system_ai_tools_search from "../system/ai/tools/search.js";
import type * as system_contactSessions from "../system/contactSessions.js";
import type * as system_conversations from "../system/conversations.js";
import type * as system_plugins from "../system/plugins.js";
import type * as system_secrets from "../system/secrets.js";
import type * as system_subscriptions from "../system/subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  constants: typeof constants;
  http: typeof http;
  "lib/extractTextContent": typeof lib_extractTextContent;
  "lib/secrets": typeof lib_secrets;
  playground: typeof playground;
  "private/contactSessions": typeof private_contactSessions;
  "private/conversations": typeof private_conversations;
  "private/files": typeof private_files;
  "private/messages": typeof private_messages;
  "private/plugins": typeof private_plugins;
  "private/secrets": typeof private_secrets;
  "private/vapi": typeof private_vapi;
  "private/widgetSettings": typeof private_widgetSettings;
  "public/contactSessions": typeof public_contactSessions;
  "public/conversations": typeof public_conversations;
  "public/messages": typeof public_messages;
  "public/organizations": typeof public_organizations;
  "public/secrets": typeof public_secrets;
  "public/widgetSettings": typeof public_widgetSettings;
  "system/ai/agents/supportAgent": typeof system_ai_agents_supportAgent;
  "system/ai/constants": typeof system_ai_constants;
  "system/ai/rag": typeof system_ai_rag;
  "system/ai/tools/escalateConversation": typeof system_ai_tools_escalateConversation;
  "system/ai/tools/resolveConversation": typeof system_ai_tools_resolveConversation;
  "system/ai/tools/search": typeof system_ai_tools_search;
  "system/contactSessions": typeof system_contactSessions;
  "system/conversations": typeof system_conversations;
  "system/plugins": typeof system_plugins;
  "system/secrets": typeof system_secrets;
  "system/subscriptions": typeof system_subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
};
