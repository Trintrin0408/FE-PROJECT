import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token from localStorage
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (globalThis.window !== undefined) {
      const token = localStorage.getItem('bnwems_token');
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor — handle 401 globally and auto-retry transient DB errors.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && !isAuthRoute) {
      if (globalThis.window !== undefined) {
        localStorage.removeItem('bnwems_token');
        localStorage.removeItem('bnwems_user');
        globalThis.window.location.href = '/auth/login';
      }
    }

    // Prisma P2024 (connection pool timeout on remote Aiven DB) surfaces as HTTP 400 with
    // code: 'DB_ERROR'. Retry once after 400 ms — pool contention is transient.
    const data = error.response?.data as { code?: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = error.config as any;
    if (error.response?.status === 400 && data?.code === 'DB_ERROR' && config && !config._dbRetried) {
      config._dbRetried = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return api.request(config);
    }

    // Log remaining 4xx/5xx in dev (excludes auth routes like login/forgot-password — their errors are shown inline).
    if (process.env.NODE_ENV !== 'production' && error.response && error.response.status >= 400 && !isAuthRoute) {
      console.error(
        `[API ${error.response.status}] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response.data,
      );
    }
    throw error;
  }
);

export default api;
