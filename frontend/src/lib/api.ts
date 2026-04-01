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

// Show detailed error notification
const showDetailedError = (error: any) => {
  const errorData = error.response?.data?.error;
  const serverMessage = error.response?.data?.message;
  const statusCode = error.response?.status;
  const message = errorData?.message || serverMessage || error.message || 'An error occurred';
  const code = errorData?.code;
  const details = errorData?.details;

  let displayMessage = message;
  if (statusCode) displayMessage += ` [${statusCode}]`;
  if (code) displayMessage += ` (${code})`;
  if (details) displayMessage += ` - ${JSON.stringify(details).substring(0, 100)}`;

  toast.error(displayMessage, { duration: 5000 });
};

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

    showDetailedError(error);
    
    return Promise.reject(error);
  }
);

export default api;
