import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sol_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Sin borrar también 'sol_usuario', AuthProvider lo sigue leyendo como
      // "autenticado" tras la recarga (usuario != null pero sin token real),
      // dispara la misma petición sin Authorization, vuelve a dar 401 —
      // loop infinito de recargas (bug real encontrado en producción: un
      // tenant que se suspende a mitad de sesión dejaba al navegador
      // recargando sin parar).
      localStorage.removeItem('sol_access_token');
      localStorage.removeItem('sol_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
