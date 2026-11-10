import { useState } from 'react';
import { User } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { ComboboxBusqueda } from '../ComboboxBusqueda/ComboboxBusqueda';
import { ModalCrearClienteRapido } from '../ModalCrearClienteRapido/ModalCrearClienteRapido';
import { PaginaResultado } from '../../../types/pagina-resultado';

export interface ClienteOpcion {
  id: string;
  nombre: string;
}

/**
 * Extraído de TravelReservas.tsx (auditoría UX Fase 5) — buscador con
 * autocompletado (mismo patrón que FacturacionNueva.tsx) + alta rápida.
 * Compartido entre la carga manual de reservas, Reservar vuelo y Reservar
 * hotel. Benchmark 2026-11-09 (Fase 7.4) — el alta rápida ya no es un
 * mini-formulario inline ad-hoc: es el mismo modal corto genérico
 * (`ModalCrearClienteRapido`) que usan Facturación y cualquier otro buscador
 * de cliente, con link a la página completa (`/clientes/nuevo`).
 */
export function SelectorClienteConCrear({ cliente, onSeleccionar }: { cliente: ClienteOpcion | null; onSeleccionar: (c: ClienteOpcion | null) => void }) {
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
      <ComboboxBusqueda<ClienteOpcion>
        valor={cliente}
        onSeleccionar={onSeleccionar}
        obtenerId={(c) => c.id}
        obtenerEtiqueta={(c) => c.nombre}
        placeholder="Buscar cliente…"
        icono={<User size={15} />}
        buscar={async (texto) =>
          (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
        }
        onCrearNuevo={() => setModalCrearAbierto(true)}
        etiquetaCrearNuevo="Crear nuevo cliente"
      />
      {modalCrearAbierto && (
        <ModalCrearClienteRapido
          onClose={() => setModalCrearAbierto(false)}
          onCreado={(c) => {
            setModalCrearAbierto(false);
            onSeleccionar(c);
          }}
        />
      )}
    </div>
  );
}
