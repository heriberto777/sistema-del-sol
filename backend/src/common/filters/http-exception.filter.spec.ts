import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { PrismaService } from '../../prisma/prisma.service';

function hostCon(request: Record<string, unknown>) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpExceptionFilter', () => {
  let prisma: { errorLog: { create: jest.Mock } };
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    prisma = { errorLog: { create: jest.fn().mockResolvedValue({}) } };
    filter = new HttpExceptionFilter(prisma as unknown as PrismaService);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('registra un ErrorLog cuando el 500 viene de un request autenticado como tenant', () => {
    const { host, response } = hostCon({
      method: 'POST',
      url: '/api/facturas',
      user: { tenantId: 'tenant-1', userId: 'user-1' },
    });

    filter.catch(new Error('boom'), host);

    expect(prisma.errorLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1', metodo: 'POST', ruta: '/api/facturas', statusCode: 500 }),
      }),
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('no registra nada si el request no tiene usuario autenticado (ej. ruta pública o error pre-guard)', () => {
    const { host } = hostCon({ method: 'GET', url: '/api/algo' });

    filter.catch(new Error('boom'), host);

    expect(prisma.errorLog.create).not.toHaveBeenCalled();
  });

  it('no registra nada en una excepción de negocio esperable (404), aunque haya usuario', () => {
    const { host } = hostCon({ method: 'GET', url: '/api/facturas/x', user: { tenantId: 'tenant-1', userId: 'user-1' } });

    filter.catch(new NotFoundException('no existe'), host);

    expect(prisma.errorLog.create).not.toHaveBeenCalled();
  });

  it('no registra nada en un 400 de validación, aunque haya usuario', () => {
    const { host } = hostCon({ method: 'POST', url: '/api/facturas', user: { tenantId: 'tenant-1', userId: 'user-1' } });

    filter.catch(new BadRequestException('dato inválido'), host);

    expect(prisma.errorLog.create).not.toHaveBeenCalled();
  });

  it('no explota si se instancia sin PrismaService (uso en otros tests que no les importa este detalle)', () => {
    const filterSinPrisma = new HttpExceptionFilter();
    const { host } = hostCon({ method: 'POST', url: '/api/x', user: { tenantId: 'tenant-1', userId: 'user-1' } });

    expect(() => filterSinPrisma.catch(new Error('boom'), host)).not.toThrow();
  });
});
