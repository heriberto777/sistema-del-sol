import axios from 'axios';

/**
 * Ítem H-4 — sin interceptores a propósito, mismo criterio que
 * `cobros-publicos-api-client.ts`: quien ve el documento llega desde el
 * link de un email/WhatsApp, sin sesión de tenant ni de plataforma.
 */
export const documentosPublicosApiClient = axios.create({
  baseURL: '/api',
});
