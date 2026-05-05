import api from './api';
import { toast } from 'react-hot-toast';

export interface ConflictError {
  code: 'CONFLICT';
  message: string;
  serverVersion: string;
  localVersion: string;
}

export async function mutateWithOptimisticLock<T>(
  method: 'put' | 'delete',
  url: string,
  options?: {
    version?: string;
    data?: unknown;
  }
): Promise<T> {
  const { version, data } = options || {};
  
  if (!version) {
    if (method === 'delete') {
      return api.delete(url).then(r => r.data.data);
    }
    return api.put(url, data).then(r => r.data.data);
  }
  
  const headers = { 'If-Match': version };
  
  try {
    let response;
    if (method === 'delete') {
      response = await api.delete(url, { headers });
    } else {
      response = await api.put(url, data, { headers });
    }
    return response.data.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: { code?: string; message?: string; serverVersion?: string } } };
    
    if (axiosError.response?.status === 412) {
      toast.error('Data has changed on the server. Please refresh and try again.', {
        duration: 5000,
      });
      throw {
        code: 'CONFLICT',
        message: axiosError.response.data?.message || 'Data has changed. Please refresh.',
        serverVersion: axiosError.response.data?.serverVersion || '',
        localVersion: version,
      } as ConflictError;
    }
    
    throw error;
  }
}

export function extractVersion(data: { updatedAt?: string } | undefined): string {
  if (!data) return '';
  return data.updatedAt || '';
}

export function getVersionHeader(version: string | undefined): Record<string, string> {
  if (!version) return {};
  return { 'If-Match': version };
}