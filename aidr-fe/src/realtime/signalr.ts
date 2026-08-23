import * as signalR from '@microsoft/signalr';

let connection: signalR.HubConnection | null = null;

export function getHubConnection(accessToken?: string | null) {
  const hubUrl = import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs';
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hubUrl}/notifications`, {
      accessTokenFactory: () => accessToken ?? '',
    })
    .withAutomaticReconnect()
    .build();

  return connection;
}
