import { TasasCambioService } from './tasas-cambio.service';
import { TasasCambioRepository } from './tasas-cambio.repository';

describe('TasasCambioService', () => {
  let service: TasasCambioService;
  let repository: jest.Mocked<TasasCambioRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorMoneda: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<TasasCambioRepository>;
    service = new TasasCambioService(repository);
  });

  it('crear normaliza la moneda a mayúsculas', async () => {
    await service.crear({ moneda: 'usd', tasa: 58.5 }, 'tenant-1');
    expect(repository.crear).toHaveBeenCalledWith({ moneda: 'USD', tasa: 58.5 }, 'tenant-1');
  });

  it('buscarPorMoneda normaliza la moneda a mayúsculas', async () => {
    await service.buscarPorMoneda('eur');
    expect(repository.buscarPorMoneda).toHaveBeenCalledWith('EUR');
  });

  it('actualizar normaliza la moneda solo si viene en el dto', async () => {
    await service.actualizar('t1', { tasa: 60 });
    expect(repository.actualizar).toHaveBeenCalledWith('t1', { tasa: 60 });

    await service.actualizar('t1', { moneda: 'cad', tasa: 43 });
    expect(repository.actualizar).toHaveBeenCalledWith('t1', { moneda: 'CAD', tasa: 43 });
  });
});
