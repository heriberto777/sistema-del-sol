import axios from 'axios';

/**
 * Sin interceptores a propósito: quien paga es el cliente de un tenant
 * llegando desde un link de pago, sin sesión de plataforma ni de tenant —
 * no debe mezclarse con AuthContext/PlatformAuthContext. Distinto de
 * `pagosPublicosApiClient` (que es para la pasarela de PLATAFORMA
 * cobrándole al tenant, un contexto completamente distinto).
 */
export const cobrosPublicosApiClient = axios.create({
  baseURL: '/api',
});
