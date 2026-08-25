import * as signalR from '@microsoft/signalr';
import type { ChatMessage } from '../types/chat';

const RECEIVE_METHOD = 'ReceiveMessage';

let connection: signalR.HubConnection | null = null;
let receiveHandler: ((message: ChatMessage) => void) | null = null;
let joinedThreadId: string | null = null;

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

  connection.on(RECEIVE_METHOD, (payload: ChatMessage) => {
    receiveHandler?.(payload);
  });

  connection.onreconnected(async () => {
    if (!joinedThreadId || !connection) return;
    try {
      await connection.invoke('JoinThread', joinedThreadId);
    } catch {
      // Rejoin is best-effort; REST still works.
    }
  });

  return connection;
}

export async function startChatHub(
  getAccessToken: () => string | null | undefined,
  onReceive: (message: ChatMessage) => void,
) {
  receiveHandler = onReceive;
  const hub = ensureConnection(getAccessToken);

  if (hub.state === signalR.HubConnectionState.Connected) return hub;
  if (hub.state === signalR.HubConnectionState.Connecting) return hub;

  await hub.start();
  return hub;
}

export async function stopChatHub() {
  receiveHandler = null;
  joinedThreadId = null;
  if (!connection) return;

  const hub = connection;
  connection = null;

  try {
    await hub.stop();
  } catch {
    // Ignore stop failures during logout / teardown.
  }
}

export async function joinChatThread(threadId: string) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;

  if (joinedThreadId && joinedThreadId !== threadId) {
    try {
      await connection.invoke('LeaveThread', joinedThreadId);
    } catch {
      // ignore
    }
  }

  joinedThreadId = threadId;
  await connection.invoke('JoinThread', threadId);
}

export async function leaveChatThread(threadId?: string) {
  const id = threadId ?? joinedThreadId;
  if (!id || !connection || connection.state !== signalR.HubConnectionState.Connected) {
    if (!threadId || threadId === joinedThreadId) joinedThreadId = null;
    return;
  }

  try {
    await connection.invoke('LeaveThread', id);
  } catch {
    // ignore
  }

  if (joinedThreadId === id) joinedThreadId = null;
}

export function getChatHubConnection() {
  return connection;
}
