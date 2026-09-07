import { ModoFacturacionProyecto } from '@prisma/client';
import { ProyectosService } from './proyectos.service';
import { ProyectosRepository } from './proyectos.repository';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { ClientesService } from '../clientes/clientes.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';

describe('ProyectosService', () => {
  let service: ProyectosService;
  let repository: jest.Mocked<ProyectosRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;

  const dto: CrearProyectoDto = { nombre: 'Rediseño de marca', clienteId: 'c1', modoFacturacion: ModoFacturacionProyecto.PRECIO_FIJO };

  beforeEach(() => {
    repository = { crearProyecto: jest.fn(), buscarProyectoPorId: jest.fn() } as unknown as jest.Mocked<ProyectosRepository>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'c1' }) } as unknown as jest.Mocked<ClientesService>;
    empleadosRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'e1', salarioBrutoMensual: '34666' }),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    configuracionesService = { buscarValor: jest.fn().mockResolvedValue('173.33') } as unknown as jest.Mocked<ConfiguracionesService>;
    service = new ProyectosService(repository, clientesService, empleadosRepository, configuracionesService);
  });

  describe('crear', () => {
    it('valida que el cliente exista y pertenezca al tenant antes de crear (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      clientesService.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.crear(dto, 't1')).rejects.toThrow('no encontrado');
      expect(repository.crearProyecto).not.toHaveBeenCalled();
    });

    it('valida el responsable si viene informado', async () => {
      await service.crear({ ...dto, responsableId: 'e1' }, 't1');
      expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e1');
    });

    it('no valida responsable si no viene (es opcional)', async () => {
      await service.crear(dto, 't1');
      expect(empleadosRepository.buscarPorId).not.toHaveBeenCalled();
    });

    it('crea el proyecto una vez validado', async () => {
      await service.crear(dto, 't1');
      expect(repository.crearProyecto).toHaveBeenCalledWith(dto, 't1');
    });
  });

  describe('costoHoraEmpleado', () => {
    it('resuelve el salario del empleado y la config de horas laborables, y calcula el costo por hora', async () => {
      const resultado = await service.costoHoraEmpleado('e1', 't1');
      expect(configuracionesService.buscarValor).toHaveBeenCalledWith('PROYECTOS_HORAS_LABORABLES_MES', 't1', '173.33');
      expect(resultado).toBeCloseTo(200, 1);
    });
  });
});
