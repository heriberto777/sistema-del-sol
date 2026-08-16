import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

interface Opcion {
  etiqueta: string;
  ruta: string;
  permiso: string;
}

const OPCIONES: Opcion[] = [
  { etiqueta: 'Nueva factura', ruta: '/facturacion?crear=1', permiso: 'facturacion.crear' },
  { etiqueta: 'Nuevo cliente', ruta: '/contactos?crear=cliente', permiso: 'clientes.crear' },
  { etiqueta: 'Nuevo proveedor', ruta: '/contactos?crear=proveedor', permiso: 'compras.crear' },
  { etiqueta: 'Nuevo producto', ruta: '/productos?crear=1', permiso: 'precios.editar' },
  { etiqueta: 'Nueva orden de compra', ruta: '/compras?crear=1', permiso: 'compras.crear' },
  { etiqueta: 'Nueva bodega', ruta: '/inventario?crear=1', permiso: 'admin.configuracion' },
];

/**
 * Botón "+" global en la barra superior — acceso rápido a crear desde
 * cualquier pantalla, sin tener que navegar primero al módulo. Cada opción
 * navega a la página dueña del formulario con `?crear=…`, que la página lee
 * al montar para abrir su modal (ver Contactos/Productos/Compras/Inventario).
 */
export function GlobalCrearMenu() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const opcionesVisibles = OPCIONES.filter((o) => tienePermiso(o.permiso));

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  if (opcionesVisibles.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-sol-500 text-lg font-medium text-white hover:bg-sol-600"
        aria-label="Crear nuevo"
      >
        +
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {opcionesVisibles.map((opcion) => (
            <button
              key={opcion.ruta}
              type="button"
              onClick={() => {
                setAbierto(false);
                navigate(opcion.ruta);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
