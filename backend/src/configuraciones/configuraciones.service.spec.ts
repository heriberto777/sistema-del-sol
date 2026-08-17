import { ConfiguracionesService } from './configuraciones.service';
import { ConfiguracionesRepository } from './configuraciones.repository';

describe('ConfiguracionesService', () => {
  let service: ConfiguracionesService;
  let repository: jest.Mocked<ConfiguracionesRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      actualizar: jest.fn(),
      buscarPorClave: jest.fn(),
    } as unknown as jest.Mocked<ConfiguracionesRepository>;
    service = new ConfiguracionesService(repository);
  });

  describe('buscarValor', () => {
    it('devuelve el valor guardado si el tenant tiene la clave sembrada', async () => {
      repository.buscarPorClave.mockResolvedValue({ valor: '200' } as never);

      const resultado = await service.buscarValor('POS_TOLERANCIA_ARQUEO', 'tenant-1', '50');

      expect(resultado).toBe('200');
    });

    it('cae al valor por defecto si el tenant no tiene la clave sembrada', async () => {
      repository.buscarPorClave.mockResolvedValue(null);

      const resultado = await service.buscarValor('POS_TOLERANCIA_ARQUEO', 'tenant-1', '50');

      expect(resultado).toBe('50');
    });
  });
});
