import { ServiceUnavailableException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesRepository } from './clientes.repository';
import { ListasPrecioRepository } from '../listas-precio/listas-precio.repository';
import { CategoriasClienteRepository } from '../categorias-cliente/categorias-cliente.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';

const CLIENTE = { id: 'c1', nombre: 'Constructora Rivas', rncCedula: '101-88231-4', email: 'rivas@ejemplo.com', telefono: '+18095551234' };

describe('ClientesService', () => {
  let service: ClientesService;
  let repository: jest.Mocked<Pick<ClientesRepository, 'buscarPorId' | 'buscarFacturasParaEstadoCuenta' | 'sumaPagosPorFacturas'>>;
  let prisma: { tenant: { findUnique: jest.Mock }; configuracion: { findUnique: jest.Mock } };
  let emailChannel: jest.Mocked<Pick<EmailChannel, 'enviar'>>;
  let whatsAppChannel: jest.Mocked<Pick<WhatsAppChannel, 'enviar'>>;

  beforeEach(() => {
    repository = {
      buscarPorId: jest.fn().mockResolvedValue(CLIENTE),
      buscarFacturasParaEstadoCuenta: jest.fn().mockResolvedValue([]),
      sumaPagosPorFacturas: jest.fn().mockResolvedValue([]),
    };
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ logo: null, nombre: 'Ferretería Demo', rnc: null, direccion: null, telefono: null }) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) };
    whatsAppChannel = { enviar: jest.fn().mockResolvedValue(true) };
    service = new ClientesService(
      repository as unknown as ClientesRepository,
      {} as ListasPrecioRepository,
      {} as CategoriasClienteRepository,
      { emit: jest.fn() } as unknown as EventBusService,
      prisma as unknown as PrismaService,
      emailChannel as unknown as EmailChannel,
      whatsAppChannel as unknown as WhatsAppChannel,
    );
  });

  describe('estadoCuenta', () => {
    it('una factura pagada cuenta como saldoPendiente 0, sin consultar Pago', async () => {
      repository.buscarFacturasParaEstadoCuenta.mockResolvedValue([
        { id: 'f1', numero: '001', ncf: 'B0100000001', tipoFactura: 'CONTADO', fecha: new Date('2026-09-01'), total: 1000 as never, pagada: true },
      ]);

      const resultado = await service.estadoCuenta('c1');

      expect(resultado.facturas[0].saldoPendiente).toBe(0);
      expect(resultado.totalFacturado).toBe(1000);
      expect(resultado.totalPagado).toBe(1000);
      expect(resultado.saldoPendiente).toBe(0);
      expect(repository.sumaPagosPorFacturas).toHaveBeenCalledWith([]);
    });

    it('una factura CRÉDITO sin pagos registrados cuenta el total completo como pendiente', async () => {
      repository.buscarFacturasParaEstadoCuenta.mockResolvedValue([
        { id: 'f1', numero: '002', ncf: 'B0200000001', tipoFactura: 'CREDITO', fecha: new Date('2026-09-01'), total: 2000 as never, pagada: false },
      ]);
      repository.sumaPagosPorFacturas.mockResolvedValue([]);

      const resultado = await service.estadoCuenta('c1');

      expect(resultado.facturas[0].saldoPendiente).toBe(2000);
      expect(resultado.totalPagado).toBe(0);
      expect(resultado.saldoPendiente).toBe(2000);
    });

    it('una factura CRÉDITO con pago parcial resta lo pagado del total', async () => {
      repository.buscarFacturasParaEstadoCuenta.mockResolvedValue([
        { id: 'f1', numero: '003', ncf: null, tipoFactura: 'CREDITO', fecha: new Date('2026-09-01'), total: 2000 as never, pagada: false },
      ]);
      repository.sumaPagosPorFacturas.mockResolvedValue([{ facturaId: 'f1', _sum: { monto: 800 as never } }] as never);

      const resultado = await service.estadoCuenta('c1');

      expect(resultado.facturas[0].saldoPendiente).toBe(1200);
      expect(resultado.totalPagado).toBe(800);
      expect(resultado.saldoPendiente).toBe(1200);
    });

    it('una nota de crédito (total negativo) reduce el saldo pendiente total, no lo suma', async () => {
      repository.buscarFacturasParaEstadoCuenta.mockResolvedValue([
        { id: 'f1', numero: '004', ncf: null, tipoFactura: 'CREDITO', fecha: new Date('2026-09-01'), total: 2000 as never, pagada: false },
        { id: 'f2', numero: '005', ncf: null, tipoFactura: 'NOTA_CREDITO', fecha: new Date('2026-09-05'), total: -500 as never, pagada: false },
      ]);
      repository.sumaPagosPorFacturas.mockResolvedValue([]);

      const resultado = await service.estadoCuenta('c1');

      expect(resultado.totalFacturado).toBe(1500);
      expect(resultado.saldoPendiente).toBe(1500);
    });

    it('pasa el rango desde/hasta como Date al repositorio', async () => {
      await service.estadoCuenta('c1', '2026-01-01', '2026-01-31');

      expect(repository.buscarFacturasParaEstadoCuenta).toHaveBeenCalledWith('c1', new Date('2026-01-01'), new Date('2026-01-31'));
    });

    it('sin rango, no le pasa fechas al repositorio', async () => {
      await service.estadoCuenta('c1');

      expect(repository.buscarFacturasParaEstadoCuenta).toHaveBeenCalledWith('c1', undefined, undefined);
    });

    it('trae los datos básicos del cliente', async () => {
      const resultado = await service.estadoCuenta('c1');

      expect(resultado.cliente).toEqual(CLIENTE);
    });
  });

  describe('estadoCuentaPdf', () => {
    it('genera un PDF válido', async () => {
      const buffer = await service.estadoCuentaPdf('c1', 'tenant-1');

      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });

  describe('enviarEstadoCuenta', () => {
    it('canal EMAIL adjunta el PDF y usa el HTML de resumen', async () => {
      await service.enviarEstadoCuenta('c1', 'tenant-1', { canal: 'EMAIL', destinatario: 'rivas@ejemplo.com' });

      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
      const [destino, asunto, cuerpo, adjuntos, tenantId] = emailChannel.enviar.mock.calls[0];
      expect(destino).toBe('rivas@ejemplo.com');
      expect(asunto).toBe('Estado de cuenta');
      expect(cuerpo).toContain('Constructora Rivas');
      expect(adjuntos?.[0].filename).toBe('estado-de-cuenta.pdf');
      expect(adjuntos?.[0].content.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(tenantId).toBe('tenant-1');
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
    });

    it('canal WHATSAPP manda el resumen en texto, sin adjunto (WhatsApp no soporta adjuntar PDF acá)', async () => {
      await service.enviarEstadoCuenta('c1', 'tenant-1', { canal: 'WHATSAPP', destinatario: '+18095551234' });

      expect(whatsAppChannel.enviar).toHaveBeenCalledTimes(1);
      const [destino, , cuerpo, tenantId] = whatsAppChannel.enviar.mock.calls[0];
      expect(destino).toBe('+18095551234');
      expect(cuerpo).toContain('Saldo pendiente');
      expect(tenantId).toBe('tenant-1');
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('si el canal devuelve false, lanza ServiceUnavailableException', async () => {
      whatsAppChannel.enviar.mockResolvedValue(false);

      await expect(service.enviarEstadoCuenta('c1', 'tenant-1', { canal: 'WHATSAPP', destinatario: '+18095551234' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
