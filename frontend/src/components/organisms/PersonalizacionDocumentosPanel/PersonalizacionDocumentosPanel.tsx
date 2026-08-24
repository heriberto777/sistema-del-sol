import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';

interface Configuracion {
  clave: string;
  valor: string;
}

const CLAVE_LOGO = 'DOCUMENTO_LOGO';
const CLAVE_NOTA_PIE = 'DOCUMENTO_NOTA_PIE';

/**
 * Personalización de facturas/cotizaciones/remisiones (plan de
 * integración Cuadre, ítem H-3, alcance reducido a propósito): logo +
 * nota de pie, no un editor de plantillas completo. Guarda en el store
 * genérico `Configuracion` (mismo backend que `ConfiguracionesPanel`,
 * ver ese componente para por qué estas 2 claves tienen su propio panel
 * en vez de aparecer en la tabla genérica).
 */
export function PersonalizacionDocumentosPanel() {
  const queryClient = useQueryClient();
  const [logo, setLogo] = useState<string | null>(null);
  const [notaPie, setNotaPie] = useState('');

  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<Configuracion[]>('/admin/configuraciones')).data,
  });

  useEffect(() => {
    if (!configuraciones) return;
    setLogo(configuraciones.find((c) => c.clave === CLAVE_LOGO)?.valor ?? null);
    setNotaPie(configuraciones.find((c) => c.clave === CLAVE_NOTA_PIE)?.valor ?? '');
  }, [configuraciones]);

  const guardar = useMutation({
    mutationFn: async () =>
      Promise.all([
        apiClient.put(`/admin/configuraciones/${CLAVE_LOGO}`, { valor: logo ?? '' }),
        apiClient.put(`/admin/configuraciones/${CLAVE_NOTA_PIE}`, { valor: notaPie }),
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  return (
    <Card
      titulo="Personalización de documentos"
      descripcion="Logo y nota de pie en facturas, cotizaciones y remisiones impresas."
    >
      <div className="space-y-4">
        <CampoImagen valor={logo} onChange={setLogo} label="Logo" />
        <div className="flex flex-col gap-1">
          <label htmlFor="documento-nota-pie" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nota de pie (opcional)
          </label>
          <textarea
            id="documento-nota-pie"
            value={notaPie}
            onChange={(e) => setNotaPie(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej: Gracias por su compra — términos y condiciones en nuestro sitio web"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
