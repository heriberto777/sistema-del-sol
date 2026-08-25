import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';

interface PasarelaConfig {
  pasarelaActiva: 'AZUL' | 'CARDNET' | null;
  azul: { merchantId: string | null; merchantName: string | null; currencyCode: string | null; authKeyConfigurado: boolean };
  cardnet: {
    merchantNumber: string | null;
    merchantTerminal: string | null;
    merchantTerminalAmex: string | null;
    merchantName: string | null;
    merchantType: string | null;
    acquiringInstitutionCode: string | null;
  };
}

/**
 * Credenciales de AZUL/CardNet por tenant (ítem C-1, Payment Link) — solo
 * las guarda; el checkout público (`/pagar-factura/:facturaId`) y el botón
 * "Generar link de pago" en Factura los consumen a través de estos
 * mismos datos, nunca en claro fuera de este servicio.
 */
export function PasarelaCobroConfigPanel() {
  const queryClient = useQueryClient();
  const [pasarelaActiva, setPasarelaActiva] = useState<'AZUL' | 'CARDNET' | ''>('');
  const [azulMerchantId, setAzulMerchantId] = useState('');
  const [azulMerchantName, setAzulMerchantName] = useState('');
  const [azulCurrencyCode, setAzulCurrencyCode] = useState('');
  const [azulAuthKey, setAzulAuthKey] = useState('');
  const [cardnetMerchantNumber, setCardnetMerchantNumber] = useState('');
  const [cardnetMerchantTerminal, setCardnetMerchantTerminal] = useState('');
  const [cardnetMerchantTerminalAmex, setCardnetMerchantTerminalAmex] = useState('');
  const [cardnetMerchantName, setCardnetMerchantName] = useState('');
  const [cardnetMerchantType, setCardnetMerchantType] = useState('');
  const [cardnetAcquiringInstitutionCode, setCardnetAcquiringInstitutionCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['pasarela-cobro-config'],
    queryFn: async () => (await apiClient.get<PasarelaConfig>('/admin/pasarela-cobro')).data,
  });

  useEffect(() => {
    if (!config) return;
    setPasarelaActiva(config.pasarelaActiva ?? '');
    setAzulMerchantId(config.azul.merchantId ?? '');
    setAzulMerchantName(config.azul.merchantName ?? '');
    setAzulCurrencyCode(config.azul.currencyCode ?? '');
    setCardnetMerchantNumber(config.cardnet.merchantNumber ?? '');
    setCardnetMerchantTerminal(config.cardnet.merchantTerminal ?? '');
    setCardnetMerchantTerminalAmex(config.cardnet.merchantTerminalAmex ?? '');
    setCardnetMerchantName(config.cardnet.merchantName ?? '');
    setCardnetMerchantType(config.cardnet.merchantType ?? '');
    setCardnetAcquiringInstitutionCode(config.cardnet.acquiringInstitutionCode ?? '');
  }, [config]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/admin/pasarela-cobro', {
        pasarelaActiva: pasarelaActiva || null,
        azulMerchantId,
        azulMerchantName,
        azulCurrencyCode,
        cardnetMerchantNumber,
        cardnetMerchantTerminal,
        cardnetMerchantTerminalAmex,
        cardnetMerchantName,
        cardnetMerchantType,
        cardnetAcquiringInstitutionCode,
        ...(azulAuthKey !== '' ? { azulAuthKey } : {}),
      }),
    onSuccess: () => {
      setAzulAuthKey('');
      queryClient.invalidateQueries({ queryKey: ['pasarela-cobro-config'] });
    },
    onError: () => setError('No se pudo guardar la configuración.'),
  });

  return (
    <Card
      titulo="Pasarela de pago (AZUL / CardNet)"
      descripcion='Credenciales del procesador para que tus clientes paguen sus facturas desde un link ("Generar link de pago" en el detalle de la Factura).'
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pasarela activa</label>
          <select
            value={pasarelaActiva}
            onChange={(e) => setPasarelaActiva(e.target.value as 'AZUL' | 'CARDNET' | '')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Ninguna — el botón "Generar link de pago" queda deshabilitado</option>
            <option value="AZUL">AZUL</option>
            <option value="CARDNET">CardNet</option>
          </select>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">AZUL</p>
          <FormField id="azul-merchant-id" label="Merchant ID" value={azulMerchantId} onChange={(e) => setAzulMerchantId(e.target.value)} />
          <FormField
            id="azul-merchant-name"
            label="Merchant Name"
            value={azulMerchantName}
            onChange={(e) => setAzulMerchantName(e.target.value)}
          />
          <FormField
            id="azul-currency-code"
            label="Currency Code (provisto por AZUL, junto al Merchant ID)"
            value={azulCurrencyCode}
            onChange={(e) => setAzulCurrencyCode(e.target.value)}
          />
          <FormField
            id="azul-auth-key"
            label={config?.azul.authKeyConfigurado ? 'Auth Key (ya configurada — dejar vacío para no cambiarla)' : 'Auth Key'}
            type="password"
            value={azulAuthKey}
            onChange={(e) => setAzulAuthKey(e.target.value)}
            placeholder={config?.azul.authKeyConfigurado ? '••••••••' : undefined}
          />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">CardNet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sin clave de firma — autentica con TLS 1.2 y estos datos, asignados por CardNet al afiliarse.
          </p>
          <FormField
            id="cardnet-merchant-number"
            label="Merchant Number"
            value={cardnetMerchantNumber}
            onChange={(e) => setCardnetMerchantNumber(e.target.value)}
          />
          <FormField
            id="cardnet-merchant-terminal"
            label="Merchant Terminal"
            value={cardnetMerchantTerminal}
            onChange={(e) => setCardnetMerchantTerminal(e.target.value)}
          />
          <FormField
            id="cardnet-merchant-terminal-amex"
            label="Merchant Terminal Amex (opcional)"
            value={cardnetMerchantTerminalAmex}
            onChange={(e) => setCardnetMerchantTerminalAmex(e.target.value)}
          />
          <FormField
            id="cardnet-merchant-name"
            label="Merchant Name"
            value={cardnetMerchantName}
            onChange={(e) => setCardnetMerchantName(e.target.value)}
          />
          <FormField
            id="cardnet-merchant-type"
            label="Merchant Type (código de categoría de comercio)"
            value={cardnetMerchantType}
            onChange={(e) => setCardnetMerchantType(e.target.value)}
          />
          <FormField
            id="cardnet-acquiring-institution-code"
            label="Acquiring Institution Code"
            value={cardnetAcquiringInstitutionCode}
            onChange={(e) => setCardnetAcquiringInstitutionCode(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
