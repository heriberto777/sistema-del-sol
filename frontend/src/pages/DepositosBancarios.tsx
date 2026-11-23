import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { PaginaResultado } from '../types/pagina-resultado';

interface DepositoResumen {
  id: string;
  numero: string;
  fecha: string;
  monto: string;
  estado: 'ABIERTO' | 'ANULADO';
  excedioSaldo: boolean;
  cuentaBancaria: { banco: string; numeroCuenta: string };
  bodega: { nombre: string } | null;
}

/** docs/PLAN.md — Depósito bancario (Caja → Banco). Página propia en Finanzas y Contabilidad, mismo patrón que Conteos/Gastos Menores. */
export function DepositosBancarios() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['depositos-bancarios'],
    queryFn: async () => (await apiClient.get<PaginaResultado<DepositoResumen>>('/depositos-bancarios', { params: { tamanoPagina: 50 } })).data,
  });

  const depositos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="contabilidad.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Depósitos bancarios</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Efectivo de Caja llevado a una cuenta bancaria puntual.</p>
          </div>
          {tienePermiso('contabilidad.editar') && <Button onClick={() => navigate('/depositos-bancarios/nuevo')}>Nuevo depósito</Button>}
        </div>

        <Card sinPadding>
          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && depositos.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin depósitos todavía" descripcion="Registrá un depósito cuando lleves efectivo de Caja a una cuenta bancaria." />
            </div>
          )}
          {depositos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Cuenta destino</th>
                    <th className="px-5 py-3 font-medium">Sucursal</th>
                    <th className="px-5 py-3 font-medium">Monto</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {depositos.map((d) => (
                    <tr key={d.id} className={d.excedioSaldo && d.estado === 'ABIERTO' ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}>
                      <td className="px-5 py-3 font-mono text-xs">{d.numero}</td>
                      <td className="px-5 py-3">{new Date(d.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">{d.cuentaBancaria.banco} — {d.cuentaBancaria.numeroCuenta}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.bodega?.nombre ?? '—'}</td>
                      <td className={d.excedioSaldo && d.estado === 'ABIERTO' ? 'px-5 py-3 font-semibold text-red-700 dark:text-red-400' : 'px-5 py-3'}>
                        RD$ {Number(d.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        {d.excedioSaldo && d.estado === 'ABIERTO' && <span className="ml-2 text-xs font-normal">(excedió el saldo disponible)</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={d.estado === 'ANULADO' ? 'peligro' : 'exito'}>{d.estado === 'ANULADO' ? 'Anulado' : 'Abierto'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={() => navigate(`/depositos-bancarios/${d.id}`)}>
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </RequierePermiso>
  );
}
