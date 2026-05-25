import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

let API_URL = process.env.NEXT_PUBLIC_API_URL || '';

if (!API_URL.endsWith('/api')) {
  API_URL = `${API_URL.replace(/\/$/, '')}/api`;
}

if (typeof window !== 'undefined') {
  console.log('[API] Using Base URL:', API_URL);
}

export const BASE_URL = API_URL.replace('/api', '');

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Form field error store for global access
interface FieldError {
  field: string;
  message: string;
}

interface FormErrorState {
  [formId: string]: {
    errors: Record<string, string>;
    _axiosError?: AxiosError;
  };
}

const formErrorStore: FormErrorState = {};

// Subscribe to form errors from outside
type FormErrorSubscriber = (formId: string, errors: Record<string, string>) => void;
const subscribers: Set<FormErrorSubscriber> = new Set();

export function subscribeToFormErrors(subscriber: FormErrorSubscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

function notifySubscribers(formId: string, errors: Record<string, string>) {
  subscribers.forEach(sub => sub(formId, errors));
}

export function setFormErrors(formId: string, errors: Record<string, string>) {
  formErrorStore[formId] = { errors };
  notifySubscribers(formId, errors);
}

export function clearFormErrors(formId: string) {
  delete formErrorStore[formId];
  notifySubscribers(formId, {});
}

export function getFormErrors(formId: string): Record<string, string> {
  return formErrorStore[formId]?.errors || {};
}

export function hasFormError(formId: string, field: string): boolean {
  return !!formErrorStore[formId]?.errors[field];
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add If-Match header for optimistic locking if present in config
  if ((config as any).version) {
    config.headers['If-Match'] = (config as any).version;
  }
  
  return config;
});

// Parse backend validation errors into field-level errors
function parseFieldErrors(error: AxiosError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  const responseData = error.response?.data as Record<string, unknown>;
  
  if (!responseData) return fieldErrors;
  
  // Handle Zod/validation errors with field paths
  if (responseData.issues || responseData.errors) {
    const issues = (responseData.issues || responseData.errors) as Array<{ path?: string[]; message?: string }>;
    issues.forEach(issue => {
      if (issue.path && issue.path.length > 0) {
        const field = issue.path.join('.');
        fieldErrors[field] = issue.message || 'Invalid value';
      }
    });
  }
  
  // Handle simple field-based errors
  if (responseData.fieldErrors) {
    Object.entries(responseData.fieldErrors as Record<string, string>).forEach(([field, message]) => {
      fieldErrors[field] = message as string;
    });
  }
  
  // Handle validation errors at root level
  if (responseData.message && Array.isArray(responseData.details)) {
    responseData.details.forEach((detail: { path?: string[]; message?: string }) => {
      if (detail.path && detail.path.length > 0) {
        const field = detail.path.join('.');
        fieldErrors[field] = detail.message || 'Invalid value';
      }
    });
  }
  
  // Handle backend's { success: false, error: { message: "Field X is required", code, statusCode } } format
  const errorObj = responseData.error as Record<string, unknown> | undefined;
  if (errorObj && typeof errorObj.message === 'string') {
    const msg = errorObj.message;
    // Try to extract field name from messages like "X is required" or "X must be ..."
    const fieldMatch = msg.match(/'(\w+)'\s+(is required|must)/) || msg.match(/^(\w+)\s+(is required|must)/);
    if (fieldMatch) {
      fieldErrors[fieldMatch[1].toLowerCase()] = msg;
    }
  }
  
  return fieldErrors;
}

// Show detailed error notification
const showDetailedError = (error: unknown, formId?: string) => {
  const axiosError = error as AxiosError;
  const responseData = axiosError.response?.data as Record<string, unknown> | undefined;
  const errorData = responseData?.error as Record<string, unknown> | undefined;
  const serverMessage = responseData?.message as string | undefined;
  const statusCode = axiosError.response?.status;
  const message = (errorData?.message as string) || serverMessage || (error as Error).message || 'An error occurred';
  const code = errorData?.code as string | undefined;
  const details = errorData?.details;

  // For 400/422 errors, don't show toast if we have form field errors
  const isValidationError = statusCode === 400 || statusCode === 422;
  const fieldErrors = isValidationError ? parseFieldErrors(axiosError) : {};
  
  if (formId && Object.keys(fieldErrors).length > 0) {
    setFormErrors(formId, fieldErrors);
    // Don't show toast for validation errors - let form handle display
    return;
  }

  let displayMessage = message;
  if (statusCode) displayMessage += ` [${statusCode}]`;
  if (code) displayMessage += ` (${code})`;
  if (details) displayMessage += ` - ${JSON.stringify(details).substring(0, 100)}`;

  toast.error(displayMessage, { duration: 5000 });
};

// Extended api that supports formId for field-level errors
export function useApi(formId?: string) {
  const apiWithForm = {
    async get<T>(url: string, config?: Record<string, unknown>): Promise<T> {
      try {
        const response = await api.get<T>(url, config);
        if (formId) clearFormErrors(formId);
        return response.data;
      } catch (error) {
        showDetailedError(error, formId);
        throw error;
      }
    },
    
    async post<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T> {
      try {
        const response = await api.post<T>(url, data, config);
        if (formId) clearFormErrors(formId);
        return response.data;
      } catch (error) {
        showDetailedError(error, formId);
        throw error;
      }
    },
    
    async put<T>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T> {
      try {
        const response = await api.put<T>(url, data, config);
        if (formId) clearFormErrors(formId);
        return response.data;
      } catch (error) {
        showDetailedError(error, formId);
        throw error;
      }
    },
    
    async delete<T>(url: string, config?: Record<string, unknown>): Promise<T> {
      try {
        const response = await api.delete<T>(url, config);
        if (formId) clearFormErrors(formId);
        return response.data;
      } catch (error) {
        showDetailedError(error, formId);
        throw error;
      }
    },
  };
  
  return apiWithForm;
}

// Handle auth errors and system mode detection
api.interceptors.response.use(
  (response) => {
    const systemMode = response.headers['x-system-mode'];
    if (systemMode) {
      window.dispatchEvent(new CustomEvent('system-mode-change', { detail: systemMode }));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    const systemMode = error.response?.headers?.['x-system-mode'];
    if (systemMode) {
      window.dispatchEvent(new CustomEvent('system-mode-change', { detail: systemMode }));
    }

    // Don't call showDetailedError here - let the caller handle it
    return Promise.reject(error);
  }
);

export default api;