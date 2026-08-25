import * as signalR from '@microsoft/signalr';
import type { NotificationItem } from '../types/notification';

const RECEIVE_METHOD = 'ReceiveNotification';

let connection: signalR.HubConnection | null = null;
let receiveHandler: ((notification: NotificationItem) => void) | null = null;

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
    receiveHandler?.(payload);
  });

  return connection;
}

export async function startNotificationHub(
  getAccessToken: () => string | null | undefined,
  onReceive: (notification: NotificationItem) => void,
) {
  receiveHandler = onReceive;
  const hub = ensureConnection(getAccessToken);

  if (hub.state === signalR.HubConnectionState.Connected) return hub;
  if (hub.state === signalR.HubConnectionState.Connecting) return hub;

  await hub.start();
  return hub;
}

export async function stopNotificationHub() {
  receiveHandler = null;
  if (!connection) return;

  const hub = connection;
  connection = null;

  try {
    await hub.stop();
  } catch {
    // Ignore stop failures during logout / teardown.
  }
}

export function getNotificationHubConnection() {
  return connection;
}
