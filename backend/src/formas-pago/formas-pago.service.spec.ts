import { FormasPagoService } from './formas-pago.service';
import { FormasPagoRepository } from './formas-pago.repository';

describe('FormasPagoService', () => {
  let service: FormasPagoService;
  let repository: jest.Mocked<FormasPagoRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      desmarcarEfectivoDeOtras: jest.fn(),
    } as unknown as jest.Mocked<FormasPagoRepository>;
    service = new FormasPagoService(repository);
  });

  describe('crear', () => {
    it('no toca otras formas de pago si esEfectivo no viene en true', async () => {
      await service.crear({ nombre: 'Tarjeta' }, 'tenant-1');

      expect(repository.desmarcarEfectivoDeOtras).not.toHaveBeenCalled();
      expect(repository.crear).toHaveBeenCalledWith({ nombre: 'Tarjeta' }, 'tenant-1');
    });

    it('desmarca esEfectivo de las demás formas de pago del tenant si la nueva es esEfectivo:true', async () => {
      await service.crear({ nombre: 'Efectivo', esEfectivo: true }, 'tenant-1');

      expect(repository.desmarcarEfectivoDeOtras).toHaveBeenCalledWith('tenant-1');
      expect(repository.crear).toHaveBeenCalledWith({ nombre: 'Efectivo', esEfectivo: true }, 'tenant-1');
    });
  });

  describe('actualizar', () => {
    it('al marcar esEfectivo:true en una existente, desmarca las demás EXCEPTO la que se está editando', async () => {
      await service.actualizar('fp-2', { esEfectivo: true }, 'tenant-1');

      expect(repository.desmarcarEfectivoDeOtras).toHaveBeenCalledWith('tenant-1', 'fp-2');
      expect(repository.actualizar).toHaveBeenCalledWith('fp-2', { esEfectivo: true });
    });

    it('no desmarca nada si el update no toca esEfectivo', async () => {
      await service.actualizar('fp-2', { nombre: 'Tarjeta de crédito' }, 'tenant-1');

      expect(repository.desmarcarEfectivoDeOtras).not.toHaveBeenCalled();
    });
  });
});
