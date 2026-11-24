import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { aplanarArbolCuentas, type CuentaContablePlana } from '../lib/cuentas-arbol';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
type NaturalezaCuenta = 'DEUDORA' | 'ACREEDORA';

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza a ModalNuevaCuenta de CuentasContablesTable.tsx. */
export function CatalogoCuentaNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCuenta>('GASTO');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCuenta>('DEUDORA');
  const [cuentaPadreId, setCuentaPadreId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContablePlana[]>('/contabilidad/cuentas')).data,
  });
  const plano = aplanarArbolCuentas(cuentas ?? []);

  const asignarCorrelativo = useMutation({
    mutationFn: async () => (await apiClient.post<{ valor: string }>('/admin/correlativos/CUENTA_CONTABLE/siguiente')).data,
    onSuccess: ({ valor }) => setCodigo(valor),
  });

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/contabilidad/cuentas', { codigo, nombre, tipo, naturaleza, cuentaPadreId: cuentaPadreId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cuentas'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate('/contabilidad/cuentas'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la cuenta — revisá que el código no esté repetido.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ codigo, nombre, tipo, naturaleza, cuentaPadreId });

  return (
    <PaginaDocumento
      titulo="Nueva cuenta contable"
      rutaVolver="/contabilidad/cuentas"
      etiquetaVolver="Volver al Catálogo de cuentas"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {codigo || '—'} {nombre && `— ${nombre}`}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-cuenta" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Agregar cuenta'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/contabilidad/cuentas')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-cuenta" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información de la cuenta">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FormField id="cuenta-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            </div>
            <Button type="button" variante="secundario" onClick={() => asignarCorrelativo.mutate()} disabled={asignarCorrelativo.isPending}>
              Asignar
            </Button>
          </div>
          <FormField id="cuenta-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta padre (opcional)</label>
            <select
              value={cuentaPadreId}
              onChange={(e) => setCuentaPadreId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Sin cuenta padre (nivel raíz)</option>
              {plano.map((c) => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.profundidad)}
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCuenta)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="ACTIVO">Activo</option>
              <option value="PASIVO">Pasivo</option>
              <option value="PATRIMONIO">Patrimonio</option>
              <option value="INGRESO">Ingreso</option>
              <option value="GASTO">Gasto</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Naturaleza</label>
            <select
              value={naturaleza}
              onChange={(e) => setNaturaleza(e.target.value as NaturalezaCuenta)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="DEUDORA">Deudora</option>
              <option value="ACREEDORA">Acreedora</option>
            </select>
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}
