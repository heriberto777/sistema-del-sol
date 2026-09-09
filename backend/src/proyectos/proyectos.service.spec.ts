import { ModoFacturacionProyecto } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { ProyectosRepository } from './proyectos.repository';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { ClientesService } from '../clientes/clientes.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FacturacionService } from '../facturacion/facturacion.service';

describe('ProyectosService', () => {
  let service: ProyectosService;
  let repository: jest.Mocked<ProyectosRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;
  let facturacionService: jest.Mocked<FacturacionService>;

  const dto: CrearProyectoDto = { nombre: 'Rediseño de marca', clienteId: 'c1', modoFacturacion: ModoFacturacionProyecto.PRECIO_FIJO };

  beforeEach(() => {
    repository = {
      crearProyecto: jest.fn(),
      buscarProyectoPorId: jest.fn(),
      buscarHitoPorId: jest.fn(),
      sumarHorasDelHito: jest.fn(),
      marcarHitoFacturado: jest.fn(),
      buscarBodegaActivaPorDefecto: jest.fn(),
      sumarFacturadoDelProyecto: jest.fn(),
      agruparHorasDelProyectoPorEmpleado: jest.fn(),
      sumarGastosDelProyecto: jest.fn(),
    } as unknown as jest.Mocked<ProyectosRepository>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'c1' }) } as unknown as jest.Mocked<ClientesService>;
    empleadosRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'e1', salarioBrutoMensual: '34666' }),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    configuracionesService = { buscarValor: jest.fn().mockResolvedValue('173.33') } as unknown as jest.Mocked<ConfiguracionesService>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    service = new ProyectosService(repository, clientesService, empleadosRepository, configuracionesService, facturacionService);
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

  describe('miEmpleadoId', () => {
    it('devuelve el id del empleado vinculado al usuario logueado', async () => {
      empleadosRepository.buscarPorUserId = jest.fn().mockResolvedValue({ id: 'e1' });
      const resultado = await service.miEmpleadoId('u1');
      expect(empleadosRepository.buscarPorUserId).toHaveBeenCalledWith('u1');
      expect(resultado).toBe('e1');
    });

    it('devuelve null si el usuario no tiene ningún empleado de RRHH vinculado', async () => {
      empleadosRepository.buscarPorUserId = jest.fn().mockResolvedValue(null);
      const resultado = await service.miEmpleadoId('u1');
      expect(resultado).toBeNull();
    });
  });

  describe('costoHoraEmpleado', () => {
    it('resuelve el salario del empleado y la config de horas laborables, y calcula el costo por hora', async () => {
      const resultado = await service.costoHoraEmpleado('e1', 't1');
      expect(configuracionesService.buscarValor).toHaveBeenCalledWith('PROYECTOS_HORAS_LABORABLES_MES', 't1', '173.33');
      expect(resultado).toBeCloseTo(200, 1);
    });
  });

  describe('facturarHito', () => {
    const BODEGA = { id: 'b1', nombre: 'Principal' };
    const FACTURA = { id: 'f1', numero: '00042', total: 59000 };

    beforeEach(() => {
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue(BODEGA as never);
      facturacionService.crear.mockResolvedValue(FACTURA as never);
    });

    it('rechaza si el hito ya fue facturado', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', facturaId: 'f-viejo' } as never);
      await expect(service.facturarHito('h1', 't1', 'u1')).rejects.toThrow('Este hito ya fue facturado');
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('PRECIO_FIJO: factura por el montoFijo del hito tal cual (antes de ITBIS)', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', nombre: 'Entrega de diseño', facturaId: null, montoFijo: 50000 } as never);
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', nombre: 'Rediseño', clienteId: 'c1', modoFacturacion: 'PRECIO_FIJO' } as never);

      const resultado = await service.facturarHito('h1', 't1', 'u1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'c1',
          bodegaId: 'b1',
          tipoFactura: 'CONTADO',
          lineas: [{ descripcionManual: 'Rediseño — Entrega de diseño', cantidad: 1, precioUnitario: 50000, aplicaItbis: true }],
        }),
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
      expect(repository.marcarHitoFacturado).toHaveBeenCalledWith('h1', 'f1');
      expect(resultado).toEqual({ facturaId: 'f1', numero: '00042', total: 59000 });
    });

    it('PRECIO_FIJO: rechaza si el hito no tiene montoFijo cargado', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', facturaId: null, montoFijo: null } as never);
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', modoFacturacion: 'PRECIO_FIJO' } as never);
      await expect(service.facturarHito('h1', 't1', 'u1')).rejects.toThrow('Este hito no tiene un monto fijo cargado');
    });

    it('POR_HORAS: suma las horas del hito y multiplica por la tarifa facturable del proyecto', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', nombre: 'Sprint 1', facturaId: null } as never);
      repository.buscarProyectoPorId.mockResolvedValue({
        id: 'p1',
        nombre: 'Consultoría',
        clienteId: 'c1',
        modoFacturacion: 'POR_HORAS',
        tarifaHoraFacturable: 1200,
      } as never);
      repository.sumarHorasDelHito.mockResolvedValue(10);

      await service.facturarHito('h1', 't1', 'u1');

      expect(repository.sumarHorasDelHito).toHaveBeenCalledWith('h1');
      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ lineas: [{ descripcionManual: 'Consultoría — Sprint 1', cantidad: 1, precioUnitario: 12000, aplicaItbis: true }] }),
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
    });

    it('POR_HORAS: rechaza si no hay horas registradas', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', facturaId: null } as never);
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', modoFacturacion: 'POR_HORAS', tarifaHoraFacturable: 1200 } as never);
      repository.sumarHorasDelHito.mockResolvedValue(0);
      await expect(service.facturarHito('h1', 't1', 'u1')).rejects.toThrow('No hay horas registradas para facturar en este hito');
    });

    it('POR_HORAS: rechaza si el proyecto no tiene tarifaHoraFacturable', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', facturaId: null } as never);
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', modoFacturacion: 'POR_HORAS', tarifaHoraFacturable: null } as never);
      repository.sumarHorasDelHito.mockResolvedValue(5);
      await expect(service.facturarHito('h1', 't1', 'u1')).rejects.toThrow('tarifa por hora facturable');
    });

    it('rechaza si el tenant no tiene ninguna bodega activa', async () => {
      repository.buscarHitoPorId.mockResolvedValue({ id: 'h1', proyectoId: 'p1', facturaId: null, montoFijo: 1000 } as never);
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', modoFacturacion: 'PRECIO_FIJO' } as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue(null as never);
      await expect(service.facturarHito('h1', 't1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('calcularRentabilidad', () => {
    beforeEach(() => {
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1' } as never);
      repository.sumarFacturadoDelProyecto.mockResolvedValue(0);
      repository.agruparHorasDelProyectoPorEmpleado.mockResolvedValue([]);
      repository.sumarGastosDelProyecto.mockResolvedValue(0);
    });

    it('valida que el proyecto exista y pertenezca al tenant (404 si no)', async () => {
      repository.buscarProyectoPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.calcularRentabilidad('p1', 't1')).rejects.toThrow('no encontrado');
    });

    it('un proyecto sin nada facturado/gastado/con horas devuelve todo en 0 sin explotar', async () => {
      const resultado = await service.calcularRentabilidad('p1', 't1');
      expect(resultado).toEqual({ facturado: 0, costoHoras: 0, costoGastos: 0, costoTotal: 0, margen: 0, margenPorcentaje: null });
    });

    it('excluye facturas ANULADAS del facturado (ya resuelto por el repositorio, acá solo se confirma que se usa el valor tal cual)', async () => {
      repository.sumarFacturadoDelProyecto.mockResolvedValue(59000);
      const resultado = await service.calcularRentabilidad('p1', 't1');
      expect(repository.sumarFacturadoDelProyecto).toHaveBeenCalledWith('p1');
      expect(resultado.facturado).toBe(59000);
    });

    it('suma el costo de horas de varios empleados con costoHora distinto', async () => {
      repository.agruparHorasDelProyectoPorEmpleado.mockResolvedValue([
        { empleadoId: 'e1', horas: 10 },
        { empleadoId: 'e2', horas: 5 },
      ]);
      empleadosRepository.buscarPorId.mockImplementation(((id: string) =>
        Promise.resolve({ id, salarioBrutoMensual: id === 'e1' ? '34666' : '17333' })) as never);

      const resultado = await service.calcularRentabilidad('p1', 't1');

      // e1: 34666/173.33 ≈ 200/h × 10h = 2000; e2: 17333/173.33 ≈ 100/h × 5h = 500
      expect(resultado.costoHoras).toBeCloseTo(2500, 0);
    });

    it('suma los gastos menores asociados al proyecto', async () => {
      repository.sumarGastosDelProyecto.mockResolvedValue(1500);
      const resultado = await service.calcularRentabilidad('p1', 't1');
      expect(resultado.costoGastos).toBe(1500);
      expect(resultado.costoTotal).toBe(1500);
    });

    it('calcula margen y margen% correctamente', async () => {
      repository.sumarFacturadoDelProyecto.mockResolvedValue(10000);
      repository.sumarGastosDelProyecto.mockResolvedValue(2000);
      repository.agruparHorasDelProyectoPorEmpleado.mockResolvedValue([{ empleadoId: 'e1', horas: 10 }]);
      // costoHora e1 ≈ 200 → costoHoras ≈ 2000; costoTotal ≈ 4000; margen ≈ 6000; margen% = 60
      const resultado = await service.calcularRentabilidad('p1', 't1');
      expect(resultado.margen).toBeCloseTo(6000, 0);
      expect(resultado.margenPorcentaje).toBeCloseTo(60, 0);
    });

    it('margenPorcentaje es null cuando no hay nada facturado (evita dividir por cero)', async () => {
      repository.sumarGastosDelProyecto.mockResolvedValue(500);
      const resultado = await service.calcularRentabilidad('p1', 't1');
      expect(resultado.facturado).toBe(0);
      expect(resultado.margenPorcentaje).toBeNull();
    });
  });

  describe('calcularCostoHorasPorHito', () => {
    it('valida que el proyecto exista y pertenezca al tenant (404 si no)', async () => {
      repository.buscarProyectoPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.calcularCostoHorasPorHito('p1', 't1')).rejects.toThrow('no encontrado');
    });

    it('devuelve un objeto vacío si ninguna tarea tiene hito u horas cargadas', async () => {
      repository.buscarProyectoPorId.mockResolvedValue({ id: 'p1', tareas: [] } as never);
      const resultado = await service.calcularCostoHorasPorHito('p1', 't1');
      expect(resultado).toEqual({});
    });

    it('agrupa por hito, sumando el costo de horas de todos los empleados de todas sus tareas, e ignora las tareas sin hito', async () => {
      repository.buscarProyectoPorId.mockResolvedValue({
        id: 'p1',
        tareas: [
          { hitoId: 'h1', registrosHoras: [{ empleadoId: 'e1', horas: 10 }, { empleadoId: 'e2', horas: 5 }] },
          { hitoId: 'h1', registrosHoras: [{ empleadoId: 'e1', horas: 2 }] },
          { hitoId: 'h2', registrosHoras: [{ empleadoId: 'e1', horas: 3 }] },
          { hitoId: null, registrosHoras: [{ empleadoId: 'e1', horas: 100 }] },
        ],
      } as never);
      empleadosRepository.buscarPorId.mockImplementation(((id: string) =>
        Promise.resolve({ id, salarioBrutoMensual: id === 'e1' ? '34666' : '17333' })) as never);

      const resultado = await service.calcularCostoHorasPorHito('p1', 't1');

      // costoHora e1 ≈ 200/h, e2 ≈ 100/h (mismos valores que el resto del spec)
      expect(resultado.h1.horasTotales).toBe(17); // 10 + 5 + 2
      expect(resultado.h1.costoHoras).toBeCloseTo(12 * 200 + 5 * 100, 0); // 2900
      expect(resultado.h2.horasTotales).toBe(3);
      expect(resultado.h2.costoHoras).toBeCloseTo(3 * 200, 0);
      expect(resultado['sin-hito']).toBeUndefined();
    });
  });
});
