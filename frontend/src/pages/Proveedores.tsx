import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface Proveedor {
  id: string;
  nombre: string;
  rnc: string | null;
  email: string | null;
  telefono: string | null;
  plazoPagoDias: number;
}

interface ProveedorFormValues {
  nombre: string;
  rnc: string;
  email: string;
  telefono: string;
  plazoPagoDias: string;
}

const PROVEEDOR_VACIO: ProveedorFormValues = { nombre: '', rnc: '', email: '', telefono: '', plazoPagoDias: '30' };

export function Proveedores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const busquedaDebounced = useDebouncedValue(busqueda);

  useEffect(() => {
    if (searchParams.get('crear') === 'proveedor') {
      setProveedorEditando(null);
      setModalAbierto(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setProveedorEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(p: Proveedor) {
    setProveedorEditando(p);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setProveedorEditando(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Proveedores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Proveedores a los que les comprás.</p>
        </div>
        <Button onClick={abrirNuevo}>Nuevo proveedor</Button>
      </div>

      <RequierePermiso permiso="compras.ver">
        <ListaProveedores
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          pagina={pagina}
          setPagina={setPagina}
          busquedaDebounced={busquedaDebounced}
          onEditar={abrirEditar}
          onNuevo={abrirNuevo}
        />
      </RequierePermiso>

      {modalAbierto && (
        <Modal titulo={proveedorEditando ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={cerrarModal}>
          <FormularioProveedor proveedor={proveedorEditando} onGuardado={cerrarModal} />
        </Modal>
      )}
    </div>
  );
}

interface ListaProps<T> {
  busqueda: string;
  setBusqueda: (v: string) => void;
  pagina: number;
  setPagina: (v: number) => void;
  busquedaDebounced: string;
  onEditar: (item: T) => void;
  onNuevo: () => void;
}

function ListaProveedores({ busqueda, setBusqueda, pagina, setPagina, busquedaDebounced, onEditar, onNuevo }: ListaProps<Proveedor>) {
  const { data } = useQuery({
    queryKey: ['proveedores', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Proveedor>>('/proveedores', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {data?.datos.length === 0 ? (
        <>
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por nombre o RNC…"
          />
          <EstadoVacio
            titulo="Todavía no hay proveedores"
            descripcion="Creá el primero para poder registrar órdenes de compra."
            etiquetaAccion="Nuevo proveedor"
            onAccion={onNuevo}
          />
        </>
      ) : (
        <Card
          sinPadding
          titulo="Proveedores"
          descripcion={data ? `${data.total} proveedor(es)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o RNC…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RNC</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Plazo de pago</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((proveedor) => (
                  <tr key={proveedor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{proveedor.nombre}</td>
                    <td className="px-5 py-3">{proveedor.rnc ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.email ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.telefono ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.plazoPagoDias} días</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu acciones={[{ etiqueta: 'Editar', onClick: () => onEditar(proveedor) }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="px-5 py-3">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FormularioProveedor({ proveedor, onGuardado }: { proveedor: Proveedor | null; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ProveedorFormValues>(
    proveedor
      ? {
          nombre: proveedor.nombre,
          rnc: proveedor.rnc ?? '',
          email: proveedor.email ?? '',
          telefono: proveedor.telefono ?? '',
          plazoPagoDias: String(proveedor.plazoPagoDias),
        }
      : PROVEEDOR_VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      nombre: valores.nombre,
      rnc: valores.rnc || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      proveedor ? apiClient.patch(`/proveedores/${proveedor.id}`, payload()) : apiClient.post('/proveedores', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onGuardado();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el proveedor. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField
        id="proveedor-nombre"
        label="Nombre"
        value={valores.nombre}
        onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        required
      />
      <FormField
        id="proveedor-rnc"
        label="RNC"
        value={valores.rnc}
        onChange={(e) => setValores((v) => ({ ...v, rnc: e.target.value }))}
      />
      <FormField
        id="proveedor-email"
        label="Email"
        type="email"
        value={valores.email}
        onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
      />
      <FormField
        id="proveedor-telefono"
        label="Teléfono"
        value={valores.telefono}
        onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
      />
      <FormField
        id="proveedor-plazo-pago"
        label="Plazo de pago (días)"
        type="number"
        min={1}
        value={valores.plazoPagoDias}
        onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
