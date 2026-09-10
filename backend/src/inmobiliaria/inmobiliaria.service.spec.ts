import { BadRequestException } from '@nestjs/common';
import { OperacionPropiedad, TipoPropiedad } from '@prisma/client';
import { InmobiliariaService } from './inmobiliaria.service';
import { InmobiliariaRepository } from './inmobiliaria.repository';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPropiedadDto } from './dto/crear-propiedad.dto';

describe('InmobiliariaService', () => {
  let service: InmobiliariaService;
  let repository: jest.Mocked<InmobiliariaRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let proyectosRepository: jest.Mocked<ProyectosRepository>;
  let prisma: { tenantModuloOverride: { findFirst: jest.Mock }; tenant: { findUnique: jest.Mock } };

  const dto: CrearPropiedadDto = {
    codigo: 'AP-1042',
    titulo: 'Apartamento en Piantini',
    tipo: TipoPropiedad.APARTAMENTO,
    operacion: OperacionPropiedad.VENTA,
    precio: 195000,
    ubicacion: 'Piantini',
  };

  beforeEach(() => {
    repository = {
      crearPropiedad: jest.fn(),
      listarPropiedades: jest.fn(),
      buscarPropiedadPorId: jest.fn(),
      actualizarPropiedad: jest.fn(),
      eliminarPropiedad: jest.fn(),
      crearContrato: jest.fn(),
      listarContratos: jest.fn(),
      buscarContratoPorId: jest.fn(),
      anularContrato: jest.fn(),
      marcarComisionPagada: jest.fn(),
      activarAdministracionAlquiler: jest.fn(),
      desactivarAdministracionAlquiler: jest.fn(),
      listarCobrosAlquiler: jest.fn(),
      buscarCobroPorId: jest.fn(),
      marcarCobrado: jest.fn(),
      marcarLiquidado: jest.fn(),
      buscarBodegaActivaPorDefecto: jest.fn(),
      vincularProyectoPreventa: jest.fn(),
      desvincularProyectoPreventa: jest.fn(),
    } as unknown as jest.Mocked<InmobiliariaRepository>;
    empleadosRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'e1' }),
      listarActivos: jest.fn(),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    clientesService = { buscarPorId: jest.fn().mockResolvedValue({ id: 'c1' }) } as unknown as jest.Mocked<ClientesService>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    proyectosRepository = { crearProyecto: jest.fn() } as unknown as jest.Mocked<ProyectosRepository>;
    // Por defecto, el tenant tiene el módulo "proyectos" activo (moduloEstaActivo lee esto directo, sin mockear el módulo).
    prisma = {
      tenantModuloOverride: { findFirst: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ plan: { modulos: [{ modulo: { clave: 'proyectos' } }] } }) },
    };
    service = new InmobiliariaService(
      repository,
      empleadosRepository,
      clientesService,
      facturacionService,
      proyectosRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe('crear', () => {
    it('valida que el agente exista y pertenezca al tenant si viene informado (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      empleadosRepository.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.crear({ ...dto, agenteId: 'e1' }, 't1')).rejects.toThrow('no encontrado');
      expect(repository.crearPropiedad).not.toHaveBeenCalled();
    });

    it('no valida agente si no viene (es opcional)', async () => {
      await service.crear(dto, 't1');
      expect(empleadosRepository.buscarPorId).not.toHaveBeenCalled();
    });

    it('crea la propiedad una vez validado el agente', async () => {
      await service.crear({ ...dto, agenteId: 'e1' }, 't1');
      expect(repository.crearPropiedad).toHaveBeenCalledWith({ ...dto, agenteId: 'e1' }, 't1');
    });
  });

  describe('listar', () => {
    it('pagina y devuelve datos+total', async () => {
      repository.listarPropiedades.mockResolvedValue([[{ id: 'p1' }], 1] as never);
      const resultado = await service.listar({ pagina: 2, tamanoPagina: 10 } as never);
      expect(repository.listarPropiedades).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
      expect(resultado).toEqual({ datos: [{ id: 'p1' }], total: 1, pagina: 2, tamanoPagina: 10 });
    });
  });

  describe('actualizar', () => {
    it('valida el agente nuevo si se cambia', async () => {
      await service.actualizar('p1', { agenteId: 'e2' } as never);
      expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e2');
      expect(repository.actualizarPropiedad).toHaveBeenCalledWith('p1', { agenteId: 'e2' });
    });
  });

  describe('listarAgentesDisponibles', () => {
    it('reusa EmpleadosRepository.listarActivos', () => {
      service.listarAgentesDisponibles();
      expect(empleadosRepository.listarActivos).toHaveBeenCalled();
    });
  });

  describe('crearContrato', () => {
    it('rechaza si la propiedad ya tiene un negocio cerrado (VENDIDA/ALQUILADA)', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', estado: 'VENDIDA', operacion: 'VENTA', agenteId: null } as never);
      await expect(service.crearContrato('p1', { clienteId: 'c1', monto: 100000 } as never, 't1')).rejects.toThrow('ya tiene un negocio cerrado');
      expect(repository.crearContrato).not.toHaveBeenCalled();
    });

    it('valida que el cliente exista y pertenezca al tenant (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', estado: 'ACTIVA', operacion: 'VENTA', agenteId: null } as never);
      clientesService.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.crearContrato('p1', { clienteId: 'c1', monto: 100000 } as never, 't1')).rejects.toThrow('no encontrado');
      expect(repository.crearContrato).not.toHaveBeenCalled();
    });

    it('deriva el tipo de la operación de la propiedad (nunca lo elige quien llama) y usa el agente de la propiedad si no viene otro', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', estado: 'ACTIVA', operacion: 'ALQUILER', agenteId: 'e1' } as never);
      await service.crearContrato('p1', { clienteId: 'c1', monto: 50000 } as never, 't1');
      expect(repository.crearContrato).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ tipo: 'ALQUILER', agenteId: 'e1' }),
        't1',
      );
    });

    it('calcula la comisión a partir del porcentaje — sin porcentaje, la comisión queda en 0', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', estado: 'ACTIVA', operacion: 'VENTA', agenteId: null } as never);
      await service.crearContrato('p1', { clienteId: 'c1', monto: 200000, porcentajeComision: 5 } as never, 't1');
      expect(repository.crearContrato).toHaveBeenCalledWith('p1', expect.objectContaining({ montoComision: 10000 }), 't1');

      await service.crearContrato('p1', { clienteId: 'c1', monto: 200000 } as never, 't1');
      expect(repository.crearContrato).toHaveBeenCalledWith('p1', expect.objectContaining({ montoComision: 0 }), 't1');
    });
  });

  describe('anularContrato', () => {
    it('rechaza si ya está anulado', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', estado: 'ANULADO', propiedad: { id: 'p1' } } as never);
      await expect(service.anularContrato('c1')).rejects.toThrow(BadRequestException);
      expect(repository.anularContrato).not.toHaveBeenCalled();
    });

    it('anula y reabre la propiedad asociada', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', propiedad: { id: 'p1' } } as never);
      await service.anularContrato('c1');
      expect(repository.anularContrato).toHaveBeenCalledWith('c1', 'p1');
    });
  });

  describe('marcarComisionPagada', () => {
    it('rechaza si el contrato está anulado', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', estado: 'ANULADO', comisionPagada: false } as never);
      await expect(service.marcarComisionPagada('c1')).rejects.toThrow('contrato anulado');
    });

    it('rechaza si ya estaba pagada', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', comisionPagada: true } as never);
      await expect(service.marcarComisionPagada('c1')).rejects.toThrow('ya está pagada');
    });

    it('marca la comisión como pagada', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', comisionPagada: false } as never);
      await service.marcarComisionPagada('c1');
      expect(repository.marcarComisionPagada).toHaveBeenCalledWith('c1');
    });
  });

  describe('activarAdministracionAlquiler (Modelo 2)', () => {
    it('rechaza si el contrato no es de alquiler', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', tipo: 'VENTA', estado: 'ACTIVO', propiedad: { propietarioId: 'cli1' } } as never);
      await expect(service.activarAdministracionAlquiler('c1', { porcentajeComisionAdministracion: 10 })).rejects.toThrow(
        'Solo un contrato de alquiler',
      );
    });

    it('rechaza si el contrato está anulado', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', tipo: 'ALQUILER', estado: 'ANULADO', propiedad: { propietarioId: 'cli1' } } as never);
      await expect(service.activarAdministracionAlquiler('c1', { porcentajeComisionAdministracion: 10 })).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la propiedad no tiene propietario asignado', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', tipo: 'ALQUILER', estado: 'ACTIVO', propiedad: { propietarioId: null } } as never);
      await expect(service.activarAdministracionAlquiler('c1', { porcentajeComisionAdministracion: 10 })).rejects.toThrow(
        'no tiene un propietario asignado',
      );
      expect(repository.activarAdministracionAlquiler).not.toHaveBeenCalled();
    });

    it('activa la administración cuando todo es válido', async () => {
      repository.buscarContratoPorId.mockResolvedValue({ id: 'c1', tipo: 'ALQUILER', estado: 'ACTIVO', propiedad: { propietarioId: 'cli1' } } as never);
      await service.activarAdministracionAlquiler('c1', { porcentajeComisionAdministracion: 10 });
      expect(repository.activarAdministracionAlquiler).toHaveBeenCalledWith('c1', { porcentajeComisionAdministracion: 10 });
    });
  });

  describe('marcarCobradoAlquiler (Modelo 2)', () => {
    it('rechaza si el cobro ya fue procesado', async () => {
      repository.buscarCobroPorId.mockResolvedValue({ id: 'co1', estado: 'COBRADO' } as never);
      await expect(service.marcarCobradoAlquiler('co1', {}, 't1', 'u1')).rejects.toThrow('ya fue procesado');
      expect(repository.marcarCobrado).not.toHaveBeenCalled();
    });

    it('sin generarFactura, marca cobrado sin tocar Facturación (registro interno / "sin comprobante")', async () => {
      repository.buscarCobroPorId.mockResolvedValue({
        id: 'co1',
        estado: 'PENDIENTE',
        periodo: '2026-09',
        montoAlquiler: 20000,
        contratoPropiedad: { clienteId: 'cli1', propiedad: { titulo: 'Villa X' } },
      } as never);
      await service.marcarCobradoAlquiler('co1', { generarFactura: false }, 't1', 'u1');
      expect(facturacionService.crear).not.toHaveBeenCalled();
      expect(repository.marcarCobrado).toHaveBeenCalledWith('co1', null);
    });

    it('con generarFactura, exige una bodega activa y genera la Factura real (CON NCF/e-CF según la modalidad del tenant)', async () => {
      repository.buscarCobroPorId.mockResolvedValue({
        id: 'co1',
        estado: 'PENDIENTE',
        periodo: '2026-09',
        montoAlquiler: 20000,
        contratoPropiedad: { clienteId: 'cli1', propiedad: { titulo: 'Villa X' } },
      } as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue({ id: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.marcarCobradoAlquiler('co1', { generarFactura: true, aplicaItbis: true }, 't1', 'u1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'cli1',
          bodegaId: 'b1',
          lineas: [expect.objectContaining({ precioUnitario: 20000, aplicaItbis: true })],
        }),
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
      expect(repository.marcarCobrado).toHaveBeenCalledWith('co1', 'f1');
    });

    it('con generarFactura, rechaza si el tenant no tiene bodega activa configurada', async () => {
      repository.buscarCobroPorId.mockResolvedValue({
        id: 'co1',
        estado: 'PENDIENTE',
        periodo: '2026-09',
        montoAlquiler: 20000,
        contratoPropiedad: { clienteId: 'cli1', propiedad: { titulo: 'Villa X' } },
      } as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue(null as never);

      await expect(service.marcarCobradoAlquiler('co1', { generarFactura: true }, 't1', 'u1')).rejects.toThrow('ninguna bodega activa');
      expect(repository.marcarCobrado).not.toHaveBeenCalled();
    });
  });

  describe('liquidarPropietarioAlquiler (Modelo 2)', () => {
    it('rechaza si el cobro todavía no fue cobrado al inquilino', async () => {
      repository.buscarCobroPorId.mockResolvedValue({ id: 'co1', estado: 'PENDIENTE' } as never);
      await expect(service.liquidarPropietarioAlquiler('co1')).rejects.toThrow('todavía no se cobró');
      expect(repository.marcarLiquidado).not.toHaveBeenCalled();
    });

    it('rechaza si ya fue liquidado', async () => {
      repository.buscarCobroPorId.mockResolvedValue({ id: 'co1', estado: 'LIQUIDADO' } as never);
      await expect(service.liquidarPropietarioAlquiler('co1')).rejects.toThrow('ya fue liquidado');
    });

    it('liquida un cobro ya cobrado', async () => {
      repository.buscarCobroPorId.mockResolvedValue({ id: 'co1', estado: 'COBRADO' } as never);
      await service.liquidarPropietarioAlquiler('co1');
      expect(repository.marcarLiquidado).toHaveBeenCalledWith('co1');
    });
  });

  describe('crearPreventa (Modelo 3)', () => {
    it('rechaza si el tenant no tiene el módulo de Proyectos activo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ plan: { modulos: [] } });
      await expect(service.crearPreventa('p1', { clienteId: 'c1' }, 't1')).rejects.toThrow('módulo de Proyectos');
      expect(repository.buscarPropiedadPorId).not.toHaveBeenCalled();
    });

    it('rechaza si la propiedad es de alquiler', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', operacion: 'ALQUILER', estado: 'ACTIVA', proyectoPreventaId: null, titulo: 'Villa X' } as never);
      await expect(service.crearPreventa('p1', { clienteId: 'c1' }, 't1')).rejects.toThrow('solo aplica a propiedades en venta');
    });

    it('rechaza si ya tiene un proyecto de preventa vinculado', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', operacion: 'VENTA', estado: 'ACTIVA', proyectoPreventaId: 'proy1', titulo: 'Villa X' } as never);
      await expect(service.crearPreventa('p1', { clienteId: 'c1' }, 't1')).rejects.toThrow('ya tiene un proyecto de preventa');
      expect(proyectosRepository.crearProyecto).not.toHaveBeenCalled();
    });

    it('rechaza si la propiedad ya tiene un negocio cerrado (VENDIDA/ALQUILADA)', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', operacion: 'VENTA', estado: 'VENDIDA', proyectoPreventaId: null, titulo: 'Villa X' } as never);
      await expect(service.crearPreventa('p1', { clienteId: 'c1' }, 't1')).rejects.toThrow('ya tiene un negocio cerrado');
    });

    it('valida que el cliente exista y pertenezca al tenant (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', operacion: 'VENTA', estado: 'ACTIVA', proyectoPreventaId: null, titulo: 'Villa X' } as never);
      clientesService.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.crearPreventa('p1', { clienteId: 'c1' }, 't1')).rejects.toThrow('no encontrado');
      expect(proyectosRepository.crearProyecto).not.toHaveBeenCalled();
    });

    it('crea el Proyecto en modo PRECIO_FIJO, lo vincula, y la propiedad queda RESERVADA', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', operacion: 'VENTA', estado: 'ACTIVA', proyectoPreventaId: null, titulo: 'Villa X' } as never);
      proyectosRepository.crearProyecto.mockResolvedValue({ id: 'proy1' } as never);

      const resultado = await service.crearPreventa('p1', { clienteId: 'c1' }, 't1');

      expect(proyectosRepository.crearProyecto).toHaveBeenCalledWith(
        { nombre: 'Preventa — Villa X', clienteId: 'c1', modoFacturacion: 'PRECIO_FIJO' },
        't1',
      );
      expect(repository.vincularProyectoPreventa).toHaveBeenCalledWith('p1', 'proy1');
      expect(resultado).toEqual({ id: 'proy1' });
    });
  });

  describe('desvincularPreventa (Modelo 3)', () => {
    it('rechaza si la propiedad no tiene un proyecto de preventa vinculado', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', proyectoPreventaId: null } as never);
      await expect(service.desvincularPreventa('p1')).rejects.toThrow('no tiene un proyecto de preventa');
      expect(repository.desvincularProyectoPreventa).not.toHaveBeenCalled();
    });

    it('desvincula el proyecto', async () => {
      repository.buscarPropiedadPorId.mockResolvedValue({ id: 'p1', proyectoPreventaId: 'proy1' } as never);
      await service.desvincularPreventa('p1');
      expect(repository.desvincularProyectoPreventa).toHaveBeenCalledWith('p1');
    });
  });
});
