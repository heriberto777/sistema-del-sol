import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ProyectosIaService } from './proyectos-ia.service';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'w1',
  tenantId: 't1',
  iaProveedor: null,
  iaModelo: null,
  iaApiKeyCifrado: null,
};

describe('ProyectosIaService', () => {
  let service: ProyectosIaService;
  let whatsappConfigRepository: jest.Mocked<WhatsappConfigRepository>;
  let conversacionIaService: jest.Mocked<ConversacionIaService>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    whatsappConfigRepository = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
    } as unknown as jest.Mocked<WhatsappConfigRepository>;
    conversacionIaService = {
      completar: jest.fn().mockResolvedValue('{"hitos":[],"tareasSinHito":[{"titulo":"Cotizar materiales","prioridad":"ALTA"}]}'),
    } as unknown as jest.Mocked<ConversacionIaService>;
    service = new ProyectosIaService(whatsappConfigRepository, conversacionIaService);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('rechaza si el tenant no configuró ningún proveedor de IA (reusa la config de WhatsApp)', async () => {
    await expect(service.generarTareas('t1', 'Remodelación', 'Remodelar el local de Piantini')).rejects.toThrow(BadRequestException);
    expect(conversacionIaService.completar).not.toHaveBeenCalled();
  });

  it('rechaza si tiene proveedor pero no key (config a medio llenar)', async () => {
    whatsappConfigRepository.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaProveedor: 'ANTHROPIC' } as never);
    await expect(service.generarTareas('t1', 'Remodelación', 'Remodelar el local de Piantini')).rejects.toThrow(BadRequestException);
  });

  it('descifra la key del tenant y la pasa al proveedor correcto', async () => {
    whatsappConfigRepository.obtenerOCrear.mockResolvedValue({
      ...CONFIG_VACIA,
      iaProveedor: 'ANTHROPIC',
      iaModelo: 'claude-sonnet-5',
      iaApiKeyCifrado: cifrar('sk-ant-real'),
    } as never);

    await service.generarTareas('t1', 'Remodelación', 'Remodelar el local de Piantini');

    expect(conversacionIaService.completar).toHaveBeenCalledWith(
      'ANTHROPIC',
      [{ role: 'user', content: expect.stringContaining('Remodelación') }],
      expect.objectContaining({ apiKey: 'sk-ant-real', modelo: 'claude-sonnet-5' }),
    );
  });

  it('rechaza con ServiceUnavailableException si la IA no devuelve nada', async () => {
    whatsappConfigRepository.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaProveedor: 'ANTHROPIC', iaApiKeyCifrado: cifrar('sk-ant-real') } as never);
    conversacionIaService.completar.mockResolvedValue(null);
    await expect(service.generarTareas('t1', 'x', 'descripción de prueba')).rejects.toThrow(ServiceUnavailableException);
  });

  it('parsea el plan (hitos + tareas sueltas) de la respuesta de la IA', async () => {
    whatsappConfigRepository.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaProveedor: 'ANTHROPIC', iaApiKeyCifrado: cifrar('sk-ant-real') } as never);
    const resultado = await service.generarTareas('t1', 'Remodelación', 'Remodelar el local de Piantini');
    expect(resultado).toEqual({ hitos: [], tareasSinHito: [{ titulo: 'Cotizar materiales', prioridad: 'ALTA' }] });
  });
});
