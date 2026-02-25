import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
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
    // Detect system mode from headers
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
    
    // Even on error, check if we have a system mode header
    const systemMode = error.response?.headers?.['x-system-mode'];
    if (systemMode) {
      window.dispatchEvent(new CustomEvent('system-mode-change', { detail: systemMode }));
    }
    
    return Promise.reject(error);
  }
);

export default api;
