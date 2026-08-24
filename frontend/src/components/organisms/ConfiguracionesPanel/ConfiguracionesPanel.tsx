import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Select } from '../../atoms/Select/Select';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FORMATOS_IMPRESION } from '../../../constants/formato-impresion';

interface Configuracion {
  clave: string;
  valor: string;
}

const CLAVE_FORMATO_IMPRESION_DEFAULT = 'FORMATO_IMPRESION_DEFAULT';

// Ítem H-3 — logo/nota de pie tienen su propio panel con widgets adecuados
// (CampoImagen, textarea) en vez de este input de una línea; un data URI de
// logo acá sería ilegible y fácil de corromper por accidente al editarlo.
// Ítem D-1 — las 2 claves de segunda capa de autorización son booleanas
// ('true'/'false'); un checkbox propio es más claro que un input de texto
// libre donde alguien podría tipear "verdadero" por error.
const CLAVES_CON_PANEL_PROPIO = new Set([
  'DOCUMENTO_LOGO',
  'DOCUMENTO_NOTA_PIE',
  'AUTORIZACION_2FA_ANULAR',
  'AUTORIZACION_2FA_DEVOLUCION',
]);

function FilaConfiguracion({ configuracion }: { configuracion: Configuracion }) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(configuracion.valor);
  const esFormatoImpresion = configuracion.clave === CLAVE_FORMATO_IMPRESION_DEFAULT;

  const guardar = useMutation({
    mutationFn: async () => apiClient.put(`/admin/configuraciones/${configuracion.clave}`, { valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-5 py-3 font-mono text-xs">{configuracion.clave}</td>
      <td className="px-5 py-3">
        {esFormatoImpresion ? (
          <Select value={valor} onChange={(e) => setValor(e.target.value)}>
            {FORMATOS_IMPRESION.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input value={valor} onChange={(e) => setValor(e.target.value)} />
        )}
      </td>
      <td className="px-5 py-3">
        <Button
          type="button"
          variante="secundario"
          disabled={valor === configuracion.valor || guardar.isPending}
          onClick={() => guardar.mutate()}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </td>
    </tr>
  );
}

export function ConfiguracionesPanel() {
  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<Configuracion[]>('/admin/configuraciones')).data,
  });

  return (
    <Card sinPadding titulo="Parámetros" descripcion="Valores de referencia usados por distintos módulos del tenant.">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Clave</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {configuraciones
              ?.filter((c) => !CLAVES_CON_PANEL_PROPIO.has(c.clave))
              .map((configuracion) => (
                <FilaConfiguracion key={configuracion.clave} configuracion={configuracion} />
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
