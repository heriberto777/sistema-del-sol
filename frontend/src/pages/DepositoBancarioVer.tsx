import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { SelectCuentaBancaria } from '../components/molecules/SelectCuentaBancaria/SelectCuentaBancaria';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { AvisoFechaPeriodoTrabajo } from '../components/molecules/AvisoFechaPeriodoTrabajo/AvisoFechaPeriodoTrabajo';
import { useAuth } from '../hooks/useAuth';
import { useHayCambios } from '../hooks/useHayCambios';

interface DepositoDetalle {
  id: string;
  numero: string;
  fecha: string;
  monto: string;
  numeroComprobante: string | null;
  notas: string | null;
  estado: 'ABIERTO' | 'ANULADO';
  excedioSaldo: boolean;
  saldoDisponibleAlMomento: string;
  cuentaBancariaId: string;
  cuentaBancaria: { banco: string; numeroCuenta: string };
  bodegaId: string | null;
  bodega: { nombre: string } | null;
}

function aFechaInput(fecha: string) {
  return fecha.slice(0, 10);
}

/**
 * docs/PLAN.md — Depósito bancario (Caja → Banco). Ver + Editar en la
 * misma página (toggle local `editando`, mismo criterio que
 * `OrdenCompraVer`) — solo editable mientras `estado === 'ABIERTO'`.
 * Editar internamente reversa el asiento viejo y postea uno nuevo (el
 * backend nunca edita un asiento ya posteado) — invisible para este
 * formulario, que solo ve "guardó" o "no se pudo guardar".
 */
export function DepositoBancarioVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: deposito } = useQuery({
    queryKey: ['depositos-bancarios', id],
    queryFn: async () => (await apiClient.get<DepositoDetalle>(`/depositos-bancarios/${id}`)).data,
  });

  const [editando, setEditando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [notas, setNotas] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deposito && !cargado) {
      setCuentaBancariaId(deposito.cuentaBancariaId);
      setMonto(String(deposito.monto));
      setFecha(aFechaInput(deposito.fecha));
      setNumeroComprobante(deposito.numeroComprobante ?? '');
      setBodegaId(deposito.bodegaId ?? '');
      setNotas(deposito.notas ?? '');
      setCargado(true);
    }
  }, [deposito, cargado]);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['depositos-bancarios'] });
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/depositos-bancarios/${id}`, {
        cuentaBancariaId,
        monto: Number(monto),
        fecha: fecha || undefined,
        numeroComprobante: numeroComprobante || undefined,
        bodegaId: bodegaId || undefined,
        notas: notas || undefined,
      }),
    onSuccess: () => {
      confirmarGuardado();
      setEditando(false);
      // Diferido un macrotask — mismo criterio que OrdenCompraVer (ver
      // ARCHITECTURE.md → "Auditoría UX: modal → página"): invalidar en el
      // mismo tick que el toggle `editando` (que desmonta el <form>) puede
      // romper el commit de React.
      setTimeout(invalidar, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el depósito. Revisa los datos.')),
  });

  const anular = useMutation({
    mutationFn: async () => apiClient.patch(`/depositos-bancarios/${id}/anular`),
    onSuccess: () => {
      setAnulando(false);
      setTimeout(invalidar, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo anular el depósito.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cuentaBancariaId) {
      setError('Elegí la cuenta bancaria destino.');
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError('Ingresá un monto mayor a cero.');
      return;
    }
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios({ cuentaBancariaId, monto, fecha, numeroComprobante, bodegaId, notas }, cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = deposito?.estado === 'ABIERTO' && tienePermiso('contabilidad.editar');
  const puedeAnular = deposito?.estado === 'ABIERTO' && tienePermiso('contabilidad.anular');

  return (
    <PaginaDocumento
      titulo={deposito ? `Depósito bancario — ${deposito.numero}` : 'Depósito bancario'}
      rutaVolver="/depositos-bancarios"
      etiquetaVolver="Volver a Depósitos bancarios"
      haycambios={haycambios}
      resumen={
        deposito ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
              <Badge tono={deposito.estado === 'ANULADO' ? 'peligro' : 'exito'}>{deposito.estado === 'ANULADO' ? 'Anulado' : 'Abierto'}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuenta destino</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {deposito.cuentaBancaria.banco} — {deposito.cuentaBancaria.numeroCuenta}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                RD$ {Number(editando ? monto || 0 : deposito.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        ) : null
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-ver-deposito" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : deposito ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {puedeAnular && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => setAnulando(true)}>
                Anular
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/depositos-bancarios')}>
              Volver
            </Button>
          </>
        ) : null
      }
    >
      {!deposito ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          {deposito.excedioSaldo && deposito.estado === 'ABIERTO' && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              Este depósito superó el saldo disponible de Caja y Bancos en el momento en que se registró (saldo de ese momento: RD${' '}
              {Number(deposito.saldoDisponibleAlMomento).toLocaleString('es-DO', { minimumFractionDigits: 2 })}). No bloquea nada, pero
              conviene revisarlo o corregirlo con "Editar".
            </div>
          )}
          {editando ? (
            <form id="form-ver-deposito" onSubmit={onSubmit} className="space-y-4">
              <Card titulo="Depósito">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta bancaria destino</label>
                    <SelectCuentaBancaria value={cuentaBancariaId} onChange={setCuentaBancariaId} />
                  </div>
                  <FormField id="deposito-ver-monto" label="Monto depositado" type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
                  <div className="flex flex-col gap-1">
                    <FormField id="deposito-ver-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                    <AvisoFechaPeriodoTrabajo fecha={fecha} />
                  </div>
                  <FormField
                    id="deposito-ver-comprobante"
                    label="Número de comprobante del banco (opcional)"
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sucursal de origen (opcional, informativo)</label>
                    <SelectorBodega value={bodegaId} onChange={setBodegaId} />
                  </div>
                  <FormField id="deposito-ver-notas" label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
                </div>
              </Card>
            </form>
          ) : (
            <Card titulo="Depósito">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(deposito.fecha).toLocaleDateString('es-DO')}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Comprobante del banco</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{deposito.numeroComprobante ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal de origen</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{deposito.bodega?.nombre ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Notas</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{deposito.notas ?? '—'}</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {anulando && deposito && (
        <ConfirmModal
          titulo="¿Anular este depósito?"
          descripcion={
            <>
              Se revertirá el asiento contable del depósito <b>{deposito.numero}</b> (RD${' '}
              {Number(deposito.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}). No se puede deshacer.
            </>
          }
          confirmarTexto="Anular depósito"
          confirmando={anular.isPending}
          onConfirmar={() => anular.mutate()}
          onCancelar={() => setAnulando(false)}
        />
      )}
    </PaginaDocumento>
  );
}
