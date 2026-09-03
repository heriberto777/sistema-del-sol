/**
 * Subdominios que ningún tenant puede tomar para su tienda pública
 * (`<subdominio>.dominio.com`) — colisionarían con infraestructura real
 * del propio SaaS o con convenciones estándar de hosting. `app` es el
 * caso real: el panel de administración de TODOS los tenants vive fijo
 * en `app.dominio.com`, así que un tenant con subdominio "app" haría que
 * su tienda pública y el panel de admin peleen por el mismo hostname.
 */
export const SUBDOMINIOS_RESERVADOS = [
  'app',
  'www',
  'api',
  'admin',
  'mail',
  'smtp',
  'webmail',
  'ftp',
  'cdn',
  'static',
  'assets',
  'docs',
  'status',
  'blog',
  'staging',
  'dev',
  'test',
  'ns1',
  'ns2',
  'autoconfig',
  'autodiscover',
];
