import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';

interface TenantEmpresa {
  nombre: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

/** Ítem "e-CF real" (pieza 1) — datos del emisor obligatorios para facturación electrónica, hoy solo `nombre`/`rnc` existían (y `rnc` no era editable por el propio tenant). */
export function TenantEmpresaPanel() {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery({
    queryKey: ['tenant-empresa'],
    queryFn: async () => (await apiClient.get<TenantEmpresa>('/admin/empresa')).data,
  });

  const [nombre, setNombre] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!empresa) return;
    setNombre(empresa.nombre ?? '');
    setRnc(empresa.rnc ?? '');
    setDireccion(empresa.direccion ?? '');
    setTelefono(empresa.telefono ?? '');
    setEmail(empresa.email ?? '');
  }, [empresa]);

  const guardar = useMutation({
    mutationFn: async () => apiClient.patch('/admin/empresa', { nombre, rnc, direccion, telefono, email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-empresa'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Card
      titulo="Datos de mi empresa"
      descripcion="Nombre, RNC y contacto del negocio — obligatorios para emitir e-CF (facturación electrónica DGII) y usados como emisor en los documentos impresos."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField id="empresa-nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="empresa-rnc" label="RNC" value={rnc} onChange={(e) => setRnc(e.target.value)} />
        <FormField id="empresa-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <FormField id="empresa-telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <FormField id="empresa-email" label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}
