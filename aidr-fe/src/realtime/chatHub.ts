import * as signalR from '@microsoft/signalr';
import type { ChatMessage, ChatThreadReadEvent, ChatTypingEvent } from '../types/chat';

const RECEIVE_METHOD = 'ReceiveMessage';
const THREAD_READ_METHOD = 'ThreadRead';
const TYPING_METHOD = 'Typing';

export type ChatHubHandlers = {
  onMessage?: (message: ChatMessage) => void;
  onThreadRead?: (event: ChatThreadReadEvent) => void;
  onTyping?: (event: ChatTypingEvent) => void;
};

let connection: signalR.HubConnection | null = null;
let handlers: ChatHubHandlers = {};

function hubBaseUrl() {
  return import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs';
}

function ensureConnection(getAccessToken: () => string | null | undefined) {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hubBaseUrl()}/chat`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .build();

  // The server delivers chat events per user group, joined on connect, so there is nothing to
  // re-subscribe to after a reconnect.
  connection.on(RECEIVE_METHOD, (payload: ChatMessage) => handlers.onMessage?.(payload));
  connection.on(THREAD_READ_METHOD, (payload: ChatThreadReadEvent) =>
    handlers.onThreadRead?.(payload),
  );
  connection.on(TYPING_METHOD, (payload: ChatTypingEvent) => handlers.onTyping?.(payload));

  return connection;
}

export async function startChatHub(
  getAccessToken: () => string | null | undefined,
  nextHandlers: ChatHubHandlers,
) {
  handlers = nextHandlers;
  const hub = ensureConnection(getAccessToken);

  if (
    hub.state === signalR.HubConnectionState.Connected ||
    hub.state === signalR.HubConnectionState.Connecting
  ) {
    return hub;
  }

  await hub.start();
  return hub;
}

export async function stopChatHub() {
  handlers = {};
  if (!connection) return;

  const hub = connection;
  connection = null;

  try {
    await hub.stop();
  } catch {
    // Ignore stop failures during logout / teardown.
  }
}

/** Best-effort typing signal — never throws, the composer must not care if it fails. */
export async function sendTypingSignal(threadId: string, isTyping: boolean) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;

  try {
    await connection.invoke('Typing', threadId, isTyping);
  } catch {
    // Typing is disposable.
  }
}

export function isChatHubConnected() {
  return connection?.state === signalR.HubConnectionState.Connected;
}

export function getChatHubConnection() {
  return connection;
}
