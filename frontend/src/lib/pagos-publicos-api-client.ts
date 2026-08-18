import axios from 'axios';

/**
 * Sin interceptores a propósito: quien paga es el admin del tenant
 * llegando desde un link de email, sin sesión de plataforma ni de
 * tenant — no debe mezclarse con AuthContext/PlatformAuthContext.
 */
export const pagosPublicosApiClient = axios.create({
  baseURL: '/api',
});
