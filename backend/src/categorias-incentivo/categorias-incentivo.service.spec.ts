import { ServiceUnavailableException } from '@nestjs/common';
import { CategoriasIncentivoService } from './categorias-incentivo.service';
import { CategoriasIncentivoRepository } from './categorias-incentivo.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';

describe('CategoriasIncentivoService', () => {
  let service: CategoriasIncentivoService;
  let repository: jest.Mocked<Pick<CategoriasIncentivoRepository, 'resumenPeriodo' | 'listarDestinatarios'>>;
  let emailChannel: jest.Mocked<Pick<EmailChannel, 'enviar'>>;
  let whatsAppChannel: jest.Mocked<Pick<WhatsAppChannel, 'enviar'>>;

  beforeEach(() => {
    repository = { resumenPeriodo: jest.fn(), listarDestinatarios: jest.fn() };
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) };
    whatsAppChannel = { enviar: jest.fn().mockResolvedValue(true) };
    service = new CategoriasIncentivoService(repository as unknown as CategoriasIncentivoRepository, emailChannel as unknown as EmailChannel, whatsAppChannel as unknown as WhatsAppChannel);
  });

  describe('listarDestinatarios', () => {
    it('delega en el repositorio', async () => {
      repository.listarDestinatarios.mockResolvedValue([{ id: 'u1', nombre: 'Gerente', email: 'gerente@ejemplo.com' }] as never);

      const resultado = await service.listarDestinatarios();

      expect(resultado).toEqual([{ id: 'u1', nombre: 'Gerente', email: 'gerente@ejemplo.com' }]);
    });
  });

  describe('resumen', () => {
    it('rechaza un mes con formato inválido', async () => {
      await expect(service.resumen('2026/09')).rejects.toThrow('El mes debe venir en formato YYYY-MM');
    });

    it('calcula % y monto ganado por renglón, y el cumplimiento general ponderado por peso (no promedio simple)', async () => {
      repository.resumenPeriodo.mockResolvedValue([
        { categoria: { id: 'c1', nombre: 'CIGUAS APPS', peso: '2500' } as never, tareasTotales: 100, tareasCompletadas: 97 },
        { categoria: { id: 'c2', nombre: 'Staff', peso: '500' } as never, tareasTotales: 4, tareasCompletadas: 4 },
      ]);

      const resultado = await service.resumen('2026-09');

      expect(resultado.renglones[0]).toEqual({ id: 'c1', nombre: 'CIGUAS APPS', peso: 2500, tareasTotales: 100, tareasCompletadas: 97, porcentaje: 97, montoGanado: 2425 });
      expect(resultado.renglones[1]).toEqual({ id: 'c2', nombre: 'Staff', peso: 500, tareasTotales: 4, tareasCompletadas: 4, porcentaje: 100, montoGanado: 500 });
      expect(resultado.pesoTotal).toBe(3000);
      expect(resultado.montoGanadoTotal).toBe(2925);
      // 2925/3000, NO (97+100)/2 — un renglón grande pesa más que uno chico.
      expect(resultado.porcentajeGeneral).toBeCloseTo(97.5, 5);
      expect(resultado.periodo).toBe('Septiembre de 2026');
    });

    it('un renglón sin ninguna tarea en el período cuenta 0%, no 100% (evita premiar por no cargar nada)', async () => {
      repository.resumenPeriodo.mockResolvedValue([{ categoria: { id: 'c1', nombre: 'ITT', peso: '2500' } as never, tareasTotales: 0, tareasCompletadas: 0 }]);

      const resultado = await service.resumen('2026-09');

      expect(resultado.renglones[0].porcentaje).toBe(0);
      expect(resultado.renglones[0].montoGanado).toBe(0);
    });

    it('pasa el rango correcto (primer y último día del mes, inclusive) al repositorio', async () => {
      repository.resumenPeriodo.mockResolvedValue([]);

      await service.resumen('2026-02');

      const [desde, hasta] = repository.resumenPeriodo.mock.calls[0];
      expect(desde.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(hasta.toISOString()).toBe('2026-02-28T23:59:59.999Z');
    });
  });

  describe('enviarResumen', () => {
    beforeEach(() => {
      repository.resumenPeriodo.mockResolvedValue([{ categoria: { id: 'c1', nombre: 'CIGUAS APPS', peso: '2500' } as never, tareasTotales: 10, tareasCompletadas: 10 }]);
    });

    it('canal WHATSAPP llama a whatsAppChannel con el texto formateado (asteriscos, sin HTML)', async () => {
      await service.enviarResumen('2026-09', 'WHATSAPP', '+18095550123', 't1');

      expect(whatsAppChannel.enviar).toHaveBeenCalledTimes(1);
      const [destino, asunto, cuerpo] = whatsAppChannel.enviar.mock.calls[0];
      expect(destino).toBe('+18095550123');
      expect(asunto).toContain('Septiembre de 2026');
      expect(cuerpo).toContain('*CIGUAS APPS:*');
      expect(cuerpo).toContain('🎯 *Cumplimiento General:*');
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('canal EMAIL llama a emailChannel envolviendo el mensaje en <pre> (para que se vea igual que en WhatsApp)', async () => {
      await service.enviarResumen('2026-09', 'EMAIL', 'gerencia@ejemplo.com', 't1');

      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
      const [destino, , cuerpo] = emailChannel.enviar.mock.calls[0];
      expect(destino).toBe('gerencia@ejemplo.com');
      expect(cuerpo).toContain('<pre');
      expect(cuerpo).toContain('CIGUAS APPS');
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
    });

    it('si el canal devuelve false (SMTP/Twilio no configurado), lanza ServiceUnavailableException', async () => {
      whatsAppChannel.enviar.mockResolvedValue(false);

      await expect(service.enviarResumen('2026-09', 'WHATSAPP', '+18095550123', 't1')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
