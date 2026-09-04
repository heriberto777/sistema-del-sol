import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';

type ModoAcumulacion = 'POR_MONTO' | 'POR_UNIDAD';
type CalculoLealtad = 'SUBTOTAL' | 'TOTAL';

interface ConfiguracionLealtad {
  activo: boolean;
  modoAcumulacion: ModoAcumulacion;
  montoPorPunto: string | null;
  calcularSobre: CalculoLealtad;
  itemsConDescuentoGeneranPuntos: boolean;
  valorPunto: string;
  minimoParaCanjear: number;
  diasExpiracion: number | null;
}

const VACIA: ConfiguracionLealtad = {
  activo: false,
  modoAcumulacion: 'POR_MONTO',
  montoPorPunto: '',
  calcularSobre: 'SUBTOTAL',
  itemsConDescuentoGeneranPuntos: true,
  valorPunto: '0',
  minimoParaCanjear: 0,
  diasExpiracion: null,
};

/**
 * Programa de lealtad/puntos (plan de integración Cuadre, ítem A-3) —
 * apagado por defecto. Los puntos se ganan solos al facturar (Event Bus)
 * y se canjean como forma de pago "Puntos de Lealtad" en el checkout —
 * este panel solo administra la configuración.
 */
export function LealtadPanel() {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ConfiguracionLealtad>(VACIA);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['lealtad-configuracion'],
    queryFn: async () => (await apiClient.get<ConfiguracionLealtad | null>('/lealtad/configuracion')).data,
  });

  useEffect(() => {
    if (!data) return;
    setValores({
      activo: data.activo,
      modoAcumulacion: data.modoAcumulacion,
      montoPorPunto: data.montoPorPunto ?? '',
      calcularSobre: data.calcularSobre,
      itemsConDescuentoGeneranPuntos: data.itemsConDescuentoGeneranPuntos,
      valorPunto: data.valorPunto,
      minimoParaCanjear: data.minimoParaCanjear,
      diasExpiracion: data.diasExpiracion,
    });
  }, [data]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/lealtad/configuracion', {
        activo: valores.activo,
        modoAcumulacion: valores.modoAcumulacion,
        montoPorPunto: valores.modoAcumulacion === 'POR_MONTO' ? Number(valores.montoPorPunto) : null,
        calcularSobre: valores.calcularSobre,
        itemsConDescuentoGeneranPuntos: valores.itemsConDescuentoGeneranPuntos,
        valorPunto: Number(valores.valorPunto) || 0,
        minimoParaCanjear: Number(valores.minimoParaCanjear) || 0,
        diasExpiracion: valores.diasExpiracion || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lealtad-configuracion'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar — revisá que el monto por punto esté configurado si el modo es "Por monto".')),
  });

  return (
    <Card
      titulo="Lealtad / puntos"
      descripcion="Programa de puntos por venta, canjeables como forma de pago 'Puntos de Lealtad' en el checkout. Apagado por defecto."
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={valores.activo} onChange={(e) => setValores((v) => ({ ...v, activo: e.target.checked }))} />
          Programa de lealtad activo
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo de acumulación</label>
          <Select
            value={valores.modoAcumulacion}
            onChange={(e) => setValores((v) => ({ ...v, modoAcumulacion: e.target.value as ModoAcumulacion }))}
          >
            <option value="POR_MONTO">Por monto (RD$ por punto)</option>
            <option value="POR_UNIDAD">Por unidad (1 punto por unidad vendida)</option>
          </Select>
        </div>

        {valores.modoAcumulacion === 'POR_MONTO' && (
          <>
            <FormField
              label="RD$ por cada punto ganado"
              type="number"
              min={0}
              step="0.01"
              value={valores.montoPorPunto ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, montoPorPunto: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Calcular sobre</label>
              <Select
                value={valores.calcularSobre}
                onChange={(e) => setValores((v) => ({ ...v, calcularSobre: e.target.value as CalculoLealtad }))}
              >
                <option value="SUBTOTAL">Subtotal (sin ITBIS)</option>
                <option value="TOTAL">Total (con ITBIS)</option>
              </Select>
            </div>
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={valores.itemsConDescuentoGeneranPuntos}
            onChange={(e) => setValores((v) => ({ ...v, itemsConDescuentoGeneranPuntos: e.target.checked }))}
          />
          Los ítems con descuento también generan puntos
        </label>

        <FormField
          label="Valor del punto al canjear (RD$)"
          type="number"
          min={0}
          step="0.01"
          value={valores.valorPunto}
          onChange={(e) => setValores((v) => ({ ...v, valorPunto: e.target.value }))}
        />
        <FormField
          label="Mínimo de puntos para poder canjear"
          type="number"
          min={0}
          value={String(valores.minimoParaCanjear)}
          onChange={(e) => setValores((v) => ({ ...v, minimoParaCanjear: Number(e.target.value) || 0 }))}
        />
        <FormField
          label="Días hasta que un punto expira (vacío = nunca expiran)"
          type="number"
          min={1}
          value={valores.diasExpiracion != null ? String(valores.diasExpiracion) : ''}
          onChange={(e) => setValores((v) => ({ ...v, diasExpiracion: e.target.value ? Number(e.target.value) : null }))}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
