import { apiClient } from './apiClient';

export type HealthStatus = {
  status: string;
  checks?: Record<string, string>;
  timestampUtc?: string;
};

export const healthApi = {
  async getLive(): Promise<HealthStatus> {
    const { data } = await apiClient.get<HealthStatus>('/health/live');
    return data;
  },
  async getReady(): Promise<HealthStatus> {
    const { data } = await apiClient.get<HealthStatus>('/health/ready');
    return data;
  },
};
