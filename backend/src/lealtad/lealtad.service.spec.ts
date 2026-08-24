import { BadRequestException } from '@nestjs/common';
import { LealtadService } from './lealtad.service';
import { LealtadRepository } from './lealtad.repository';

describe('LealtadService', () => {
  let service: LealtadService;
  let repository: jest.Mocked<LealtadRepository>;

  const configBase = (overrides: Record<string, unknown> = {}) => ({
    tenantId: 't1',
    activo: true,
    modoAcumulacion: 'POR_MONTO',
    montoPorPunto: 10,
    calcularSobre: 'SUBTOTAL',
    itemsConDescuentoGeneranPuntos: true,
    valorPunto: 1,
    minimoParaCanjear: 0,
    diasExpiracion: null,
    ...overrides,
  });

  const lineaBase = (overrides: Record<string, unknown> = {}) => ({
    cantidad: 2,
    precioUnitario: 100,
    descuento: 0,
    montoItbis: 36,
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      obtenerConfiguracion: jest.fn(),
      actualizarConfiguracion: jest.fn().mockResolvedValue(undefined),
      historialCliente: jest.fn(),
      ajusteManual: jest.fn().mockResolvedValue(undefined),
      buscarConfiguracionGlobal: jest.fn().mockResolvedValue(configBase()),
      buscarLineasFacturaGlobal: jest.fn().mockResolvedValue([lineaBase()]),
      acumularGlobal: jest.fn().mockResolvedValue(undefined),
      buscarMovimientosDeFacturaGlobal: jest.fn().mockResolvedValue([]),
      anularMovimientoGlobal: jest.fn().mockResolvedValue(undefined),
      buscarConfiguracionEnTx: jest.fn().mockResolvedValue(configBase()),
      buscarClienteEnTx: jest.fn().mockResolvedValue({ puntosLealtad: 1000 }),
      canjearEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LealtadRepository>;
    service = new LealtadService(repository);
  });

  describe('actualizarConfiguracion', () => {
    it('rechaza POR_MONTO sin montoPorPunto', () => {
      expect(() => service.actualizarConfiguracion('t1', { modoAcumulacion: 'POR_MONTO' } as never)).toThrow(BadRequestException);
      expect(repository.actualizarConfiguracion).not.toHaveBeenCalled();
    });

    it('acepta POR_UNIDAD sin montoPorPunto', () => {
      service.actualizarConfiguracion('t1', { modoAcumulacion: 'POR_UNIDAD' } as never);
      expect(repository.actualizarConfiguracion).toHaveBeenCalled();
    });

    it('acepta POR_MONTO con montoPorPunto', () => {
      service.actualizarConfiguracion('t1', { modoAcumulacion: 'POR_MONTO', montoPorPunto: 10 } as never);
      expect(repository.actualizarConfiguracion).toHaveBeenCalled();
    });
  });

  describe('generarDesdeFactura', () => {
    it('no acumula si el programa no está activo', async () => {
      repository.buscarConfiguracionGlobal.mockResolvedValue(configBase({ activo: false }) as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      expect(repository.acumularGlobal).not.toHaveBeenCalled();
    });

    it('no acumula para NOTA_CREDITO/NOTA_DEBITO (ni siquiera consulta la configuración)', async () => {
      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'NOTA_CREDITO' });

      expect(repository.buscarConfiguracionGlobal).not.toHaveBeenCalled();
      expect(repository.acumularGlobal).not.toHaveBeenCalled();
    });

    it('POR_MONTO sobre SUBTOTAL: floor(base neta sin ITBIS / montoPorPunto)', async () => {
      repository.buscarLineasFacturaGlobal.mockResolvedValue([lineaBase({ cantidad: 2, precioUnitario: 100, descuento: 0 })] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      // base = 2*100 - 0 = 200; 200/10 = 20 puntos
      expect(repository.acumularGlobal).toHaveBeenCalledWith('t1', 'c1', 20, 'f1', null);
    });

    it('POR_MONTO sobre TOTAL: incluye el ITBIS de la línea en la base', async () => {
      repository.buscarConfiguracionGlobal.mockResolvedValue(configBase({ calcularSobre: 'TOTAL' }) as never);
      repository.buscarLineasFacturaGlobal.mockResolvedValue([lineaBase({ cantidad: 2, precioUnitario: 100, descuento: 0, montoItbis: 36 })] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      // base = (2*100-0) + 36 = 236; floor(236/10) = 23
      expect(repository.acumularGlobal).toHaveBeenCalledWith('t1', 'c1', 23, 'f1', null);
    });

    it('POR_UNIDAD: suma la cantidad de las líneas calificantes, ignorando el monto', async () => {
      repository.buscarConfiguracionGlobal.mockResolvedValue(configBase({ modoAcumulacion: 'POR_UNIDAD', montoPorPunto: null }) as never);
      repository.buscarLineasFacturaGlobal.mockResolvedValue([
        lineaBase({ cantidad: 3 }),
        lineaBase({ cantidad: 2 }),
      ] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CREDITO' });

      expect(repository.acumularGlobal).toHaveBeenCalledWith('t1', 'c1', 5, 'f1', null);
    });

    it('itemsConDescuentoGeneranPuntos:false excluye líneas con cualquier descuento', async () => {
      repository.buscarConfiguracionGlobal.mockResolvedValue(configBase({ itemsConDescuentoGeneranPuntos: false }) as never);
      repository.buscarLineasFacturaGlobal.mockResolvedValue([
        lineaBase({ cantidad: 1, precioUnitario: 100, descuento: 0 }), // califica: 100
        lineaBase({ cantidad: 1, precioUnitario: 100, descuento: 10 }), // no califica
      ] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      expect(repository.acumularGlobal).toHaveBeenCalledWith('t1', 'c1', 10, 'f1', null); // 100/10
    });

    it('no acumula si el resultado es 0 puntos', async () => {
      repository.buscarLineasFacturaGlobal.mockResolvedValue([lineaBase({ cantidad: 1, precioUnitario: 5, descuento: 0 })] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      expect(repository.acumularGlobal).not.toHaveBeenCalled();
    });

    it('con diasExpiracion configurado, calcula una fecha de expiración futura', async () => {
      repository.buscarConfiguracionGlobal.mockResolvedValue(configBase({ diasExpiracion: 30 }) as never);
      repository.buscarLineasFacturaGlobal.mockResolvedValue([lineaBase({ cantidad: 2, precioUnitario: 100, descuento: 0 })] as never);

      await service.generarDesdeFactura({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', tipoFactura: 'CONTADO' });

      const llamada = repository.acumularGlobal.mock.calls[0];
      expect(llamada[4]).toBeInstanceOf(Date);
      expect((llamada[4] as Date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('anularPorFactura', () => {
    it('anula cada movimiento encontrado para esa factura', async () => {
      repository.buscarMovimientosDeFacturaGlobal.mockResolvedValue([
        { id: 'm1', tipo: 'ACUMULACION' },
        { id: 'm2', tipo: 'CANJE' },
      ] as never);

      await service.anularPorFactura('t1', 'f1');

      expect(repository.anularMovimientoGlobal).toHaveBeenCalledTimes(2);
    });

    it('sin movimientos, no hace nada', async () => {
      await service.anularPorFactura('t1', 'f1');
      expect(repository.anularMovimientoGlobal).not.toHaveBeenCalled();
    });
  });

  describe('procesarPagoEnTx', () => {
    const TX = {
      formaPago: { findUnique: jest.fn() },
    };

    beforeEach(() => {
      TX.formaPago.findUnique.mockReset();
    });

    it('no hace nada si la FormaPago no tiene esPuntosLealtad', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: false });

      await service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 });

      expect(repository.canjearEnTx).not.toHaveBeenCalled();
    });

    it('rechaza si el programa de lealtad no está activo', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: true });
      repository.buscarConfiguracionEnTx.mockResolvedValue(configBase({ activo: false }) as never);

      await expect(service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si valorPunto es 0 (no configurado)', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: true });
      repository.buscarConfiguracionEnTx.mockResolvedValue(configBase({ valorPunto: 0 }) as never);

      await expect(service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si los puntos necesarios no alcanzan el mínimo para canjear', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: true });
      repository.buscarConfiguracionEnTx.mockResolvedValue(configBase({ valorPunto: 1, minimoParaCanjear: 500 }) as never);

      await expect(service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si el cliente no tiene puntos suficientes', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: true });
      repository.buscarConfiguracionEnTx.mockResolvedValue(configBase({ valorPunto: 1 }) as never);
      repository.buscarClienteEnTx.mockResolvedValue({ puntosLealtad: 50 } as never);

      await expect(service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.canjearEnTx).not.toHaveBeenCalled();
    });

    it('canjea (redondeando hacia arriba) cuando todo es válido', async () => {
      TX.formaPago.findUnique.mockResolvedValue({ esPuntosLealtad: true });
      repository.buscarConfiguracionEnTx.mockResolvedValue(configBase({ valorPunto: 3, minimoParaCanjear: 0 }) as never);
      repository.buscarClienteEnTx.mockResolvedValue({ puntosLealtad: 1000 } as never);

      await service.procesarPagoEnTx(TX as never, 't1', 'c1', 'f1', { formaPagoId: 'fp1', monto: 100 });

      // 100/3 = 33.33 -> ceil = 34
      expect(repository.canjearEnTx).toHaveBeenCalledWith(TX, 't1', 'c1', 34, 'f1');
    });
  });
});
