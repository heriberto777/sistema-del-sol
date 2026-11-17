import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: 'CORRIENTE' | 'AHORROS';
  cuentaContable: CuentaContable;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Editar cuenta" de Bancos.tsx. */
export function BancoVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState<'CORRIENTE' | 'AHORROS'>('CORRIENTE');
  const [cuentaContableId, setCuentaContableId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: cuentaBancaria } = useQuery({
    queryKey: ['bancos', id],
    queryFn: async () => (await apiClient.get<CuentaBancaria>(`/bancos/${id}`)).data,
  });
  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-activo'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasActivo = (cuentas ?? []).filter((c) => c.tipo === 'ACTIVO');

  useEffect(() => {
    if (cuentaBancaria && !cargado) {
      setBanco(cuentaBancaria.banco);
      setNumeroCuenta(cuentaBancaria.numeroCuenta);
      setTipoCuenta(cuentaBancaria.tipoCuenta);
      setCuentaContableId(cuentaBancaria.cuentaContable.id);
      setCargado(true);
    }
  }, [cuentaBancaria, cargado]);

  const guardar = useMutation({
    mutationFn: async () => apiClient.patch(`/bancos/${id}`, { banco, numeroCuenta, tipoCuenta, cuentaContableId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      confirmarGuardado();
      navigate('/bancos');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cuenta bancaria. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ banco, numeroCuenta, tipoCuenta, cuentaContableId }, cargado);

  return (
    <PaginaDocumento
      titulo={cuentaBancaria ? `Cuenta bancaria — ${cuentaBancaria.banco}` : 'Cuenta bancaria'}
      rutaVolver="/bancos"
      etiquetaVolver="Volver a Bancos"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{banco || '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-ver-banco" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/bancos')}>
            Volver
          </Button>
        </>
      }
    >
      {!cuentaBancaria ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-ver-banco" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Información de la cuenta">
            <FormField id="banco-nombre" label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} required />
            <FormField id="banco-numero" label="Número de cuenta" value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de cuenta</label>
              <Select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value as 'CORRIENTE' | 'AHORROS')}>
                <option value="CORRIENTE">Corriente</option>
                <option value="AHORROS">Ahorros</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta contable</label>
              <Select value={cuentaContableId} onChange={(e) => setCuentaContableId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {cuentasActivo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
