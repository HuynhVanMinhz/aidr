import * as signalR from '@microsoft/signalr';
import type { NotificationItem } from '../types/notification';

const RECEIVE_METHOD = 'ReceiveNotification';

let connection: signalR.HubConnection | null = null;
const handlers = new Set<(notification: NotificationItem) => void>();

function hubBaseUrl() {
  return import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs';
}

function ensureConnection(getAccessToken: () => string | null | undefined) {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hubBaseUrl()}/notifications`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .build();

  connection.on(RECEIVE_METHOD, (payload: NotificationItem) => {
    handlers.forEach((h) => h(payload));
  });

  return connection;
}

export async function startNotificationHub(
  getAccessToken: () => string | null | undefined,
  onReceive: (notification: NotificationItem) => void,
) {
  addNotificationHandler(onReceive);
  const hub = ensureConnection(getAccessToken);

  if (hub.state === signalR.HubConnectionState.Connected) return hub;
  if (hub.state === signalR.HubConnectionState.Connecting) return hub;

  await hub.start();
  return hub;
}

export async function stopNotificationHub(
  onReceive?: (notification: NotificationItem) => void,
) {
  if (onReceive) {
    removeNotificationHandler(onReceive);
    // Keep connection alive if other handlers are still registered.
    if (handlers.size > 0) return;
  } else {
    handlers.clear();
  }

  if (!connection) return;
  const hub = connection;
  connection = null;
  try {
    await hub.stop();
  } catch {
    // Ignore stop failures during logout / teardown.
  }
}

/** Subscribe an additional handler to incoming notifications. */
export function addNotificationHandler(
  handler: (notification: NotificationItem) => void,
) {
  handlers.add(handler);
}

/** Remove a previously registered handler. */
export function removeNotificationHandler(
  handler: (notification: NotificationItem) => void,
) {
  handlers.delete(handler);
}

export function getNotificationHubConnection() {
  return connection;
}
