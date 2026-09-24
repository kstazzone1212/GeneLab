import type { ExperimentRecord } from '../utils/notebook';

export interface CloudAccount {
  email: string;
  createdAt: string;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8787/api';
const tokenKey = 'genelab-cloud-token';
const accountKey = 'genelab-cloud-account';

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  try {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(localStorage.getItem(tokenKey) ? { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` } : {}), ...options.headers } });
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `http-${response.status}`);
    return body;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('cloud-unavailable');
    throw error;
  }
};

export const cloudRegister = async (email: string, password: string): Promise<CloudAccount> => { const result = await request<{ account: CloudAccount; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem(tokenKey, result.token); localStorage.setItem(accountKey, JSON.stringify(result.account)); return result.account; };
export const cloudLogin = async (email: string, password: string): Promise<CloudAccount> => { const result = await request<{ account: CloudAccount; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem(tokenKey, result.token); localStorage.setItem(accountKey, JSON.stringify(result.account)); return result.account; };
export const getCloudAccount = (): CloudAccount | undefined => { try { const value = JSON.parse(localStorage.getItem(accountKey) ?? 'null'); return value?.email ? value as CloudAccount : undefined; } catch { return undefined; } };
export const cloudLogout = (): void => { localStorage.removeItem(tokenKey); localStorage.removeItem(accountKey); };
export const hasCloudSession = (): boolean => Boolean(localStorage.getItem(tokenKey));
export const syncExperiment = async (experiment: ExperimentRecord): Promise<ExperimentRecord> => (await request<{ experiment: ExperimentRecord }>('/experiments', { method: 'POST', body: JSON.stringify(experiment) })).experiment;
export const pullExperiments = async (): Promise<ExperimentRecord[]> => (await request<{ experiments: ExperimentRecord[] }>('/experiments')).experiments;
export const deleteCloudExperiment = async (id: string): Promise<void> => { await request(`/experiments/${encodeURIComponent(id)}`, { method: 'DELETE' }); };
