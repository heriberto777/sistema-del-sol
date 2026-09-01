import axios from 'axios';

/**
 * Cliente separado de `apiClient` a propósito: el storefront público
 * (`/tienda/:subdominio/**`) no tiene sesión — nunca debe adjuntar un
 * Authorization ni, sobre todo, reaccionar a un 401 redirigiendo a
 * `/login` (eso es lógica de la app de gestión, no de un comprador
 * anónimo navegando una tienda). Estos endpoints solo responden 404
 * (tienda/producto no encontrado), nunca 401.
 */
export const tiendaApiClient = axios.create({ baseURL: '/api' });
