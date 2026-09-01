import { EmisionECfEventosService } from './emision-ecf-eventos.service';
import { EmisionECfService } from './emision-ecf.service';

describe('EmisionECfEventosService', () => {
  let service: EmisionECfEventosService;
  let emisionECfService: jest.Mocked<EmisionECfService>;

  beforeEach(() => {
    emisionECfService = { emitirParaFactura: jest.fn() } as unknown as jest.Mocked<EmisionECfService>;
    service = new EmisionECfEventosService(emisionECfService);
  });

  it('alFacturarse delega en emitirParaFactura con tenantId/facturaId del payload', async () => {
    await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '236', subtotal: '200', itbis: '36', tipoFactura: 'CONTADO' });

    expect(emisionECfService.emitirParaFactura).toHaveBeenCalledWith('t1', 'f1');
  });

  it('nunca lanza si emitirParaFactura falla — no debe tumbar la venta', async () => {
    emisionECfService.emitirParaFactura.mockRejectedValue(new Error('boom'));

    await expect(
      service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '236', subtotal: '200', itbis: '36', tipoFactura: 'CONTADO' }),
    ).resolves.toBeUndefined();
  });
});
