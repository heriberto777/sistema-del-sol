import { Test } from '@nestjs/testing';
import { ContactoTelefonoService } from './contacto-telefono.service';
import { ContactoTelefonoRepository } from './contacto-telefono.repository';

describe('ContactoTelefonoService', () => {
  let service: ContactoTelefonoService;
  let repository: { buscarClientePorTelefono: jest.Mock; buscarLeadPorTelefono: jest.Mock };

  beforeEach(async () => {
    repository = { buscarClientePorTelefono: jest.fn(), buscarLeadPorTelefono: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ContactoTelefonoService, { provide: ContactoTelefonoRepository, useValue: repository }],
    }).compile();
    service = moduleRef.get(ContactoTelefonoService);
  });

  it('cliente encontrado: devuelve tipo CLIENTE y ni siquiera busca Lead', async () => {
    repository.buscarClientePorTelefono.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });

    const resultado = await service.porTelefono('+18295550000');

    expect(resultado).toEqual({ tipo: 'CLIENTE', id: 'c1', nombre: 'Juan Pérez' });
    expect(repository.buscarLeadPorTelefono).not.toHaveBeenCalled();
  });

  it('sin cliente, lead encontrado: devuelve tipo LEAD con su estado', async () => {
    repository.buscarClientePorTelefono.mockResolvedValue(null);
    repository.buscarLeadPorTelefono.mockResolvedValue({ id: 'l1', nombre: 'Prospecto', estado: 'NUEVO' });

    const resultado = await service.porTelefono('+18295550000');

    expect(resultado).toEqual({ tipo: 'LEAD', id: 'l1', nombre: 'Prospecto', estado: 'NUEVO' });
  });

  it('ni cliente ni lead: devuelve tipo DESCONOCIDO', async () => {
    repository.buscarClientePorTelefono.mockResolvedValue(null);
    repository.buscarLeadPorTelefono.mockResolvedValue(null);

    const resultado = await service.porTelefono('+18295550000');

    expect(resultado).toEqual({ tipo: 'DESCONOCIDO' });
  });
});
