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
    // Ver el mismo comentario en api-client.ts — un 401 de la propia
    // llamada de login es "contraseña incorrecta", no "sesión vencida".
    const esIntentoDeLogin = error.config?.url === '/platform/auth/login';
    if (error.response?.status === 401 && !esIntentoDeLogin) {
      // Ver el mismo comentario en api-client.ts — sin esto, PlatformAuthProvider
      // sigue leyendo 'sol_platform_admin' como "autenticado" tras la
      // recarga y cae en el mismo loop infinito de recargas.
      localStorage.removeItem('sol_platform_token');
      localStorage.removeItem('sol_platform_admin');
      window.location.href = '/plataforma/login';
    }
    return Promise.reject(error);
  },
);
