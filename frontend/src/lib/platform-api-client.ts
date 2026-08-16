import axios from 'axios';

export const platformApiClient = axios.create({
  baseURL: '/api',
});

platformApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sol_platform_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sol_platform_token');
      window.location.href = '/plataforma/login';
    }
    return Promise.reject(error);
  },
);
