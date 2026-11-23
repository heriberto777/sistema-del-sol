import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { SelectCuentaBancaria } from '../components/molecules/SelectCuentaBancaria/SelectCuentaBancaria';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { useHayCambios } from '../hooks/useHayCambios';

/**
 * docs/PLAN.md — Depósito bancario (Caja → Banco). Página propia
 * (`/depositos-bancarios/nuevo`), mismo patrón `PaginaDocumento` que
 * Gasto Menor/Asiento manual. El saldo excedido (si lo hay) se avisa
 * recién en la lista/detalle después de crear — acá no se calcula en
 * vivo para no pedirle al backend un libro mayor en cada tecla.
 */
export function DepositoBancarioNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ id: string }>('/depositos-bancarios', {
          cuentaBancariaId,
          monto: Number(monto),
          fecha: fecha || undefined,
          numeroComprobante: numeroComprobante || undefined,
          bodegaId: bodegaId || undefined,
          notas: notas || undefined,
        })
      ).data,
    onSuccess: (deposito) => {
      confirmarGuardado();
      // Diferido un macrotask (ver ARCHITECTURE.md → "Auditoría UX: modal →
      // página") — mismo criterio ya aplicado en Centros de Costo/
      // Configuración de cuentas del sistema.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['depositos-bancarios'] });
        navigate(`/depositos-bancarios/${deposito.id}`);
      }, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar el depósito.')),
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
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ cuentaBancariaId, monto, fecha, numeroComprobante, bodegaId, notas });

  return (
    <PaginaDocumento
      titulo="Nuevo depósito bancario"
      rutaVolver="/depositos-bancarios"
      etiquetaVolver="Volver a Depósitos bancarios"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {monto ? `RD$ ${Number(monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '—'}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-deposito" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Registrando…' : 'Registrar depósito'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/depositos-bancarios')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-deposito" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Depósito">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta bancaria destino</label>
              <SelectCuentaBancaria value={cuentaBancariaId} onChange={setCuentaBancariaId} />
            </div>
            <FormField id="deposito-monto" label="Monto depositado" type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            <FormField id="deposito-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <FormField
              id="deposito-comprobante"
              label="Número de comprobante del banco (opcional)"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sucursal de origen (opcional, informativo)</label>
              <SelectorBodega value={bodegaId} onChange={setBodegaId} />
            </div>
            <FormField id="deposito-notas" label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}
