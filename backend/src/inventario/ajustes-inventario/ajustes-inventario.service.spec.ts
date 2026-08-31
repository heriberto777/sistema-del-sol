import { BadRequestException } from '@nestjs/common';
import { AjustesInventarioService } from './ajustes-inventario.service';
import { AjustesInventarioRepository } from './ajustes-inventario.repository';
import { InventarioService } from '../inventario.service';
import { VariantesService } from '../../variantes/variantes.service';
import { AuthService } from '../../auth/auth.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

describe('AjustesInventarioService', () => {
  let service: AjustesInventarioService;
  let repository: jest.Mocked<AjustesInventarioRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let variantesService: jest.Mocked<VariantesService>;
  let authService: jest.Mocked<AuthService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let tenantPrisma: { client: { $transaction: jest.Mock } };

  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      crearEnTx: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn().mockResolvedValue([[], 0]),
      actualizar: jest.fn(),
      actualizarEstado: jest.fn(),
    } as unknown as jest.Mocked<AjustesInventarioRepository>;
    inventarioService = {
      validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'bodega-1', sucursalId: 's1' }),
      ajustarCantidadEnTx: jest.fn(),
    } as unknown as jest.Mocked<InventarioService>;
    variantesService = { resolverObligatoria: jest.fn().mockResolvedValue('variante-1') } as unknown as jest.Mocked<VariantesService>;
    authService = { verificarPin: jest.fn() } as unknown as jest.Mocked<AuthService>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('AJ-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    tenantPrisma = { client: { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(TX)) } };

    service = new AjustesInventarioService(
      repository,
      inventarioService,
      variantesService,
      authService,
      correlativosRepository,
      tenantPrisma as unknown as TenantPrismaService,
    );
  });

  describe('crear', () => {
    it('valida acceso a la bodega y crea el ajuste en BORRADOR sin tocar stock', async () => {
      await service.crear(
        { bodegaId: 'bodega-1', lineas: [{ productoId: 'p1', cantidad: 5, motivoAjuste: 'CORRECCION_CONTEO' }] } as never,
        'tenant-1',
        'user-1',
      );

      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-1', 'user-1');
      expect(inventarioService.ajustarCantidadEnTx).not.toHaveBeenCalled();
      expect(repository.crearEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        numero: 'AJ-00001',
        bodegaId: 'bodega-1',
        userId: 'user-1',
        lineas: [{ productoId: 'p1', cantidad: 5, motivoAjuste: 'CORRECCION_CONTEO', varianteId: 'variante-1' }],
      });
    });
  });

  describe('actualizar', () => {
    it('rechaza editar un ajuste que no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'CONFIRMADO' } as never);

      await expect(service.actualizar('a1', { lineas: [] } as never)).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('reemplaza las líneas de un ajuste en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR' } as never);

      await service.actualizar('a1', { lineas: [{ productoId: 'p1', cantidad: -2, motivoAjuste: 'MERMA' }] } as never);

      expect(repository.actualizar).toHaveBeenCalledWith('a1', {
        lineas: [{ productoId: 'p1', cantidad: -2, motivoAjuste: 'MERMA', varianteId: 'variante-1' }],
      });
    });
  });

  describe('cambiarEstado', () => {
    it('cancela un ajuste en BORRADOR sin tocar stock', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', lineas: [] } as never);

      await service.cambiarEstado('a1', { estado: 'CANCELADO' } as never, 'tenant-1', 'user-1');

      expect(inventarioService.ajustarCantidadEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'a1', 'CANCELADO');
    });

    it('rechaza confirmar/cancelar un ajuste que ya no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'CONFIRMADO', lineas: [] } as never);

      await expect(service.cambiarEstado('a1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
      await expect(service.cambiarEstado('a1', { estado: 'CANCELADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('confirmar aplica ajustarCantidadEnTx una vez por línea y marca CONFIRMADO', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        estado: 'BORRADOR',
        bodegaId: 'bodega-1',
        lineas: [
          { productoId: 'p1', varianteId: 'v1', cantidad: 5, motivoAjuste: 'CORRECCION_CONTEO', motivo: null, numeroLote: null, fechaVencimiento: null, loteId: null, producto: { controlaVencimiento: false } },
        ],
      } as never);

      await service.cambiarEstado('a1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1');

      expect(inventarioService.ajustarCantidadEnTx).toHaveBeenCalledWith(TX, {
        tenantId: 'tenant-1',
        productoId: 'p1',
        varianteId: 'v1',
        bodegaId: 'bodega-1',
        delta: 5,
        tipo: 'AJUSTE',
        userId: 'user-1',
        motivo: 'Corrección de conteo',
        motivoAjuste: 'CORRECCION_CONTEO',
        referenciaTipo: 'AJUSTE_INVENTARIO',
        referenciaId: 'a1',
        controlaVencimiento: false,
        lotesEntrada: undefined,
        loteIdSalida: undefined,
      });
      expect(authService.verificarPin).not.toHaveBeenCalled();
      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'a1', 'CONFIRMADO');
    });

    it('confirmar con una línea negativa exige PIN (Fase 9)', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        estado: 'BORRADOR',
        bodegaId: 'bodega-1',
        lineas: [
          { productoId: 'p1', varianteId: 'v1', cantidad: -3, motivoAjuste: 'MERMA', motivo: null, numeroLote: null, fechaVencimiento: null, loteId: 'lote-1', producto: { controlaVencimiento: true } },
        ],
      } as never);

      await service.cambiarEstado('a1', { estado: 'CONFIRMADO', pin: '1234' } as never, 'tenant-1', 'user-1');

      expect(authService.verificarPin).toHaveBeenCalledWith('user-1', '1234');
      expect(inventarioService.ajustarCantidadEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ delta: -3, controlaVencimiento: true, loteIdSalida: 'lote-1', lotesEntrada: undefined }),
      );
    });

    it('si verificarPin rechaza, no confirma ni toca stock', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        estado: 'BORRADOR',
        bodegaId: 'bodega-1',
        lineas: [{ productoId: 'p1', varianteId: 'v1', cantidad: -1, motivoAjuste: 'MERMA', producto: { controlaVencimiento: false } }],
      } as never);
      authService.verificarPin.mockRejectedValue(new Error('PIN incorrecto'));

      await expect(service.cambiarEstado('a1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1')).rejects.toThrow('PIN incorrecto');
      expect(inventarioService.ajustarCantidadEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarEstado).not.toHaveBeenCalled();
    });

    it('una línea de entrada con lote arma lotesEntrada', async () => {
      const fechaVencimiento = new Date('2027-01-01');
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        estado: 'BORRADOR',
        bodegaId: 'bodega-1',
        lineas: [
          { productoId: 'p1', varianteId: 'v1', cantidad: 10, motivoAjuste: 'CORRECCION_CONTEO', numeroLote: 'L-1', fechaVencimiento, loteId: null, producto: { controlaVencimiento: true } },
        ],
      } as never);

      await service.cambiarEstado('a1', { estado: 'CONFIRMADO' } as never, 'tenant-1', 'user-1');

      expect(inventarioService.ajustarCantidadEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ lotesEntrada: [{ numeroLote: 'L-1', fechaVencimiento, cantidad: 10 }] }),
      );
    });
  });
});
