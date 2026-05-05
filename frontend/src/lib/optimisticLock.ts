import api from './api';
import { toast } from 'react-hot-toast';

export interface ConflictError {
  code: 'CONFLICT';
  message: string;
  serverVersion: string;
  localVersion: string;
}

export interface MutationOptions<T> {
  onMutate?: () => void;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
  version?: string;
}

export interface OptimisticLockConfig {
  endpoint: string;
  entityId: string;
  version?: string;
  onConflict?: (serverVersion: string) => void;
}

export async function mutateWithOptimisticLock<T>(
  method: 'post' | 'put' | 'delete',
  url: string,
  data?: unknown,
  options?: MutationOptions<T>
): Promise<T> {
  const { version, onSuccess, onError, onMutate } = options || {};
  
  // Include version in request if provided
  const headers: Record<string, string> = {};
  if (version) {
    headers['If-Match'] = version;
  }
  
  try {
    const response = await api[method](url, data, { headers });
    
    if (onSuccess) {
      onSuccess(response.data.data);
    }
    
    return response.data.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: { code?: string; message?: string; serverVersion?: string } } };
    
    // Handle conflict (412 Precondition Failed)
    if (axiosError.response?.status === 412) {
      const serverVersion = axiosError.response.data?.serverVersion;
      
      // Show user-friendly error
      toast.error('Data has changed on the server. Please refresh and try again.', {
        duration: 5000,
      });
      
      // Throw a structured error that can be caught
      const conflictError: ConflictError = {
        code: 'CONFLICT',
        message: axiosError.response.data?.message || 'Data has changed. Please refresh.',
        serverVersion: serverVersion || '',
        localVersion: version || '',
      };
      
      throw conflictError;
    }
    
    if (onError) {
      onError(error);
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

export function formatConflictError(error: ConflictError): string {
  return `⚠️ ${error.message}\n\nThe data was modified by another user. Please refresh the page and try again.`;
}