import { Bell, Building2, CalendarOff, CreditCard, FileText, Gift, Plug, Target, type LucideIcon } from 'lucide-react';
import type { ItemMenu } from './menu-erp';

export interface CategoriaConfiguracionHub {
  id: string;
  etiqueta: string;
  descripcion: string;
  icono: LucideIcon;
  items: ItemMenu[];
}

/**
 * Hub central de Configuración (`/configuracion`) — benchmark 2026-11-09
 * contra Cuadre.do/Alegra, pedido explícito del usuario: consolidar en un
 * solo lugar lo que antes vivía repartido como categoría "Configuración"
 * dentro de cada dominio del menú (Ventas, Finanzas, Nómina, CRM, Travel,
 * Tienda Online, Seguridad y Administración — ver menu-erp.ts, decisión
 * explícita de deshacer el criterio "cada acción en su dominio real" SOLO
 * para esta categoría puntual). Las rutas y permisos de cada página NO
 * cambiaron — este archivo solo reagrupa los mismos ítems para presentarlos
 * como un grid de tarjetas por categoría, estilo Alegra.
 */
export const CONFIGURACION_HUB: CategoriaConfiguracionHub[] = [
  {
    id: 'empresa',
    etiqueta: 'Empresa',
    descripcion: 'Datos de tu negocio, usuarios y quién puede hacer qué.',
    icono: Building2,
    items: [
      { id: 'datos-empresa', etiqueta: 'Datos de mi empresa', ruta: '/datos-empresa', permisos: ['admin.configuracion'] },
      { id: 'parametros', etiqueta: 'Parámetros generales', ruta: '/parametros', permisos: ['admin.configuracion'] },
      { id: 'usuarios', etiqueta: 'Usuarios', ruta: '/usuarios', permisos: ['admin.usuarios'] },
      { id: 'roles', etiqueta: 'Roles y permisos', ruta: '/roles-permisos', permisos: ['admin.usuarios'] },
    ],
  },
  {
    id: 'facturacion-fiscal',
    etiqueta: 'Facturación y Documentos Fiscales',
    descripcion: 'Formato de tus documentos, NCF/e-CF y secuencias.',
    icono: FileText,
    items: [
      { id: 'formato-documentos', etiqueta: 'Formato de Documentos', ruta: '/formato-documentos', permisos: ['admin.configuracion'] },
      { id: 'documentos', etiqueta: 'Documentos (branding)', ruta: '/documentos', permisos: ['admin.configuracion'] },
      { id: 'ncf', etiqueta: 'NCF', ruta: '/ncf', permisos: ['admin.configuracion'] },
      { id: 'consecutivos', etiqueta: 'Consecutivos', ruta: '/consecutivos', permisos: ['admin.configuracion'] },
      { id: 'autorizaciones', etiqueta: 'Autorizaciones', ruta: '/autorizaciones', permisos: ['admin.configuracion'] },
    ],
  },
  {
    id: 'cobros',
    etiqueta: 'Cobros',
    descripcion: 'Cómo te pagan tus clientes en línea.',
    icono: CreditCard,
    items: [{ id: 'pasarela-pago', etiqueta: 'Pasarela de pago', ruta: '/pasarela-pago', permisos: ['admin.configuracion'] }],
  },
  {
    id: 'notificaciones-comunicacion',
    etiqueta: 'Notificaciones y Comunicación',
    descripcion: 'Correo, WhatsApp, plantillas de aviso y webhooks.',
    icono: Bell,
    items: [
      { id: 'whatsapp-config', etiqueta: 'WhatsApp', ruta: '/whatsapp-config', permisos: ['admin.configuracion'] },
      { id: 'correo-config', etiqueta: 'Correo (SMTP)', ruta: '/correo-config', permisos: ['admin.configuracion'] },
      { id: 'plantillas-notificacion', etiqueta: 'Plantillas de notificación', ruta: '/plantillas-notificacion', permisos: ['admin.configuracion'] },
      { id: 'webhooks', etiqueta: 'Webhooks', ruta: '/webhooks', permisos: ['admin.configuracion'] },
    ],
  },
  {
    id: 'ventas-fidelizacion',
    etiqueta: 'Ventas y Fidelización',
    descripcion: 'Programa de puntos para clientes frecuentes.',
    icono: Gift,
    items: [{ id: 'lealtad', etiqueta: 'Lealtad', ruta: '/lealtad', permisos: ['lealtad.ver'] }],
  },
  {
    id: 'rrhh',
    etiqueta: 'Nómina y RRHH',
    descripcion: 'Reglas de ausencias y su efecto en la nómina.',
    icono: CalendarOff,
    items: [{ id: 'tipos-ausencia', etiqueta: 'Tipos de ausencia', ruta: '/tipos-ausencia', permisos: ['rrhh.ver'], modulo: 'nomina' }],
  },
  {
    id: 'crm',
    etiqueta: 'CRM',
    descripcion: 'Etapas del pipeline y metas de venta por vendedor.',
    icono: Target,
    items: [
      { id: 'crm-etapas-pipeline', etiqueta: 'Etapas del pipeline', ruta: '/crm/etapas-pipeline', permisos: ['crm.pipeline.configurar'], modulo: 'crm' },
      { id: 'crm-metas-venta', etiqueta: 'Metas de venta', ruta: '/crm/metas-venta', permisos: ['crm.metas.configurar'], modulo: 'crm' },
    ],
  },
  {
    id: 'integraciones-modulos',
    etiqueta: 'Integraciones y Módulos',
    descripcion: 'Credenciales y branding de los módulos activables.',
    icono: Plug,
    items: [
      { id: 'travel-config', etiqueta: 'Cuenta Duffel / Hotelbeds', ruta: '/travel-config', permisos: ['admin.configuracion'], modulo: 'travel' },
      { id: 'tienda-config', etiqueta: 'Dominio propio y branding', ruta: '/tienda-online/configuracion/identidad', permisos: ['admin.configuracion'], modulo: 'ecommerce' },
    ],
  },
];
