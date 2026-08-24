import { TiposAusenciaConfigService } from './tipos-ausencia-config.service';
import { TiposAusenciaConfigRepository } from './tipos-ausencia-config.repository';

describe('TiposAusenciaConfigService', () => {
  let service: TiposAusenciaConfigService;
  let repository: jest.Mocked<TiposAusenciaConfigRepository>;

  beforeEach(() => {
    repository = { listar: jest.fn(), actualizar: jest.fn() } as unknown as jest.Mocked<TiposAusenciaConfigRepository>;
    service = new TiposAusenciaConfigService(repository);
  });

  it('actualizar fuerza maximoDiasPorAnio a null para VACACIONES aunque el body traiga un valor', async () => {
    await service.actualizar('VACACIONES', 't1', { maximoDiasPorAnio: 10 });

    expect(repository.actualizar).toHaveBeenCalledWith('VACACIONES', 't1', expect.objectContaining({ maximoDiasPorAnio: null }));
  });

  it('actualizar respeta maximoDiasPorAnio para el resto de los tipos', async () => {
    await service.actualizar('PERMISO', 't1', { maximoDiasPorAnio: 10 });

    expect(repository.actualizar).toHaveBeenCalledWith('PERMISO', 't1', expect.objectContaining({ maximoDiasPorAnio: 10 }));
  });
});
