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
    // Un 401 de /auth/login es "contraseña incorrecta" — nunca hubo sesión
    // que expiró, así que NO hay que redirigir/limpiar nada acá; el propio
    // formulario de Login ya lo maneja con su catch y muestra el error
    // inline. Sin este chequeo, cualquier intento de login fallido disparaba
    // igual la lógica de "sesión inválida" de abajo (recarga completa a
    // /login en vez del mensaje de error — bug real reportado por el
    // usuario).
    const esIntentoDeLogin = error.config?.url === '/auth/login';
    if (error.response?.status === 401 && !esIntentoDeLogin) {
      // Sin borrar también 'sol_usuario', AuthProvider lo sigue leyendo como
      // "autenticado" tras la recarga (usuario != null pero sin token real),
      // dispara la misma petición sin Authorization, vuelve a dar 401 —
      // loop infinito de recargas (bug real encontrado en producción: un
      // tenant que se suspende a mitad de sesión dejaba al navegador
      // recargando sin parar).
      localStorage.removeItem('sol_access_token');
      localStorage.removeItem('sol_usuario');
      // Mismo criterio que AuthContext.logout() — en una compu compartida,
      // dejar la sucursal elegida hace que el siguiente usuario que loguee
      // la herede.
      localStorage.removeItem('sol_sucursal_activa');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
