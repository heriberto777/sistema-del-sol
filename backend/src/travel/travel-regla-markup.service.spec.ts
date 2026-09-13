import { BadRequestException } from '@nestjs/common';
import { TravelReglaMarkupService } from './travel-regla-markup.service';
import { TravelReglaMarkupRepository } from './travel-regla-markup.repository';

describe('TravelReglaMarkupService', () => {
  let service: TravelReglaMarkupService;
  let repository: jest.Mocked<TravelReglaMarkupRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
      buscarActivaPara: jest.fn(),
    } as unknown as jest.Mocked<TravelReglaMarkupRepository>;
    service = new TravelReglaMarkupService(repository);
  });

  describe('crear', () => {
    it('rechaza si no viene ni porcentaje ni montoFijo', async () => {
      await expect(service.crear({} as never, 't1')).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('rechaza si vienen ambos', async () => {
      await expect(service.crear({ porcentaje: 10, montoFijo: 20 } as never, 't1')).rejects.toThrow(BadRequestException);
    });

    it('crea con solo porcentaje', async () => {
      await service.crear({ porcentaje: 10 } as never, 't1');
      expect(repository.crear).toHaveBeenCalledWith({ porcentaje: 10 }, 't1');
    });

    it('crea con solo montoFijo', async () => {
      await service.crear({ montoFijo: 50 } as never, 't1');
      expect(repository.crear).toHaveBeenCalledWith({ montoFijo: 50 }, 't1');
    });
  });

  describe('actualizar', () => {
    it('rechaza si el resultado final tendría ambos (porcentaje ya existía, se agrega montoFijo)', async () => {
      repository.buscarPorId.mockResolvedValue({ porcentaje: 10, montoFijo: null } as never);
      await expect(service.actualizar('r1', { montoFijo: 20 } as never)).rejects.toThrow(BadRequestException);
    });

    it('permite actualizar campos que no son porcentaje/montoFijo sin validar nada', async () => {
      await service.actualizar('r1', { activa: false } as never);
      expect(repository.buscarPorId).not.toHaveBeenCalled();
      expect(repository.actualizar).toHaveBeenCalledWith('r1', { activa: false });
    });
  });

  describe('sugerir', () => {
    it('sin regla activa, sugiere el propio costo (markup 0%)', async () => {
      repository.buscarActivaPara.mockResolvedValue(null);
      const resultado = await service.sugerir('VUELO', 250);
      expect(resultado).toEqual({ montoVentaSugerido: 250, reglaAplicada: null });
    });

    it('aplica el porcentaje de la regla activa', async () => {
      repository.buscarActivaPara.mockResolvedValue({ id: 'm1', tipo: 'VUELO', porcentaje: 12, montoFijo: null } as never);
      const resultado = await service.sugerir('VUELO', 100);
      expect(resultado.montoVentaSugerido).toBe(112);
    });

    it('aplica el montoFijo de la regla activa', async () => {
      repository.buscarActivaPara.mockResolvedValue({ id: 'm1', tipo: null, porcentaje: null, montoFijo: 30 } as never);
      const resultado = await service.sugerir('HOTEL', 200);
      expect(resultado.montoVentaSugerido).toBe(230);
    });
  });
});
