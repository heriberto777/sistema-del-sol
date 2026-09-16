import { BadRequestException } from '@nestjs/common';
import { UsoIaService } from './uso-ia.service';
import { UsoIaRepository } from './uso-ia.repository';

describe('UsoIaService', () => {
  let service: UsoIaService;
  let repository: jest.Mocked<UsoIaRepository>;

  beforeEach(() => {
    repository = {
      registrar: jest.fn(),
      contarDelMes: jest.fn(),
      buscarLimites: jest.fn().mockResolvedValue({ imagen: 20, asistente: 50 }),
    } as unknown as jest.Mocked<UsoIaRepository>;
    service = new UsoIaService(repository);
  });

  describe('intentarRegistrar', () => {
    it('registra el uso y devuelve true si todavía hay cupo', async () => {
      repository.contarDelMes.mockResolvedValue(19);

      const resultado = await service.intentarRegistrar('t1', 'IMAGEN_PRODUCTO');

      expect(resultado).toBe(true);
      expect(repository.registrar).toHaveBeenCalledWith('t1', 'IMAGEN_PRODUCTO');
    });

    it('no registra nada y devuelve false si ya se alcanzó el límite', async () => {
      repository.contarDelMes.mockResolvedValue(20);

      const resultado = await service.intentarRegistrar('t1', 'IMAGEN_PRODUCTO');

      expect(resultado).toBe(false);
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('usa el límite de asistente, no el de imagen, para el tipo ASISTENTE', async () => {
      repository.contarDelMes.mockResolvedValue(49);

      const resultado = await service.intentarRegistrar('t1', 'ASISTENTE');

      expect(resultado).toBe(true);
      repository.contarDelMes.mockResolvedValue(50);
      expect(await service.intentarRegistrar('t1', 'ASISTENTE')).toBe(false);
    });
  });

  describe('verificarYRegistrar', () => {
    it('no lanza si hay cupo', async () => {
      repository.contarDelMes.mockResolvedValue(0);
      await expect(service.verificarYRegistrar('t1', 'IMAGEN_PRODUCTO')).resolves.toBeUndefined();
    });

    it('lanza BadRequestException con el límite en el mensaje si ya se alcanzó', async () => {
      repository.contarDelMes.mockResolvedValue(20);
      await expect(service.verificarYRegistrar('t1', 'IMAGEN_PRODUCTO')).rejects.toThrow(BadRequestException);
      await expect(service.verificarYRegistrar('t1', 'IMAGEN_PRODUCTO')).rejects.toThrow(/20/);
    });
  });

  describe('consultar', () => {
    it('devuelve usados y límite sin registrar nada', async () => {
      repository.contarDelMes.mockResolvedValue(7);

      const resultado = await service.consultar('ASISTENTE');

      expect(resultado).toEqual({ usados: 7, limite: 50 });
      expect(repository.registrar).not.toHaveBeenCalled();
    });
  });
});
