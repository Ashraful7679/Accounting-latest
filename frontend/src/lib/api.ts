import axios from 'axios';
import toast from 'react-hot-toast';

let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
if (!API_URL.endsWith('/api')) {
  API_URL = `${API_URL.replace(/\/$/, '')}/api`;
}
export const BASE_URL = API_URL.replace('/api', '');

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

    // Show detailed error notification for all errors
    const errorData = error.response?.data?.error;
    const serverMessage = error.response?.data?.message;
    const statusCode = error.response?.status;
    const message = errorData?.message || serverMessage || error.message || 'An error occurred';
    const code = errorData?.code;
    const details = errorData?.details;

    const errorContent = (
      <div className="flex flex-col gap-1 max-w-sm">
        <span className="font-bold">{message}</span>
        {statusCode && (
          <span className="text-xs text-yellow-300">
            Status: {statusCode}
          </span>
        )}
        {code && (
          <span className="text-xs text-blue-300">
            Code: {code}
          </span>
        )}
        {details && (
          <details className="text-xs text-slate-400 mt-1">
            <summary className="cursor-pointer hover:text-slate-300">View details</summary>
            <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all max-h-24 overflow-auto">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>
        )}
        {!errorData && !serverMessage && (
          <span className="text-xs text-red-300">
            Network error - please check your connection
          </span>
        )}
      </div>
    );

    toast.error(errorContent, {
      duration: 6000,
    });
    
    return Promise.reject(error);
  }
);

export default api;
