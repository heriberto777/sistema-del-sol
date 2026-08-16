import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Códigos de Prisma que representan errores de cliente esperables, no bugs
// del servidor — sin este mapeo, findUniqueOrThrow/findFirstOrThrow (usado
// en cada "buscarPorId" de la app) devuelve 500 en vez de 404 cuando el
// registro no existe o pertenece a otro tenant.
const PRISMA_STATUS: Partial<Record<string, HttpStatus>> = {
  P2025: HttpStatus.NOT_FOUND, // registro no encontrado
  P2002: HttpStatus.CONFLICT, // violación de unique constraint
  P2003: HttpStatus.CONFLICT, // violación de foreign key
};

const PRISMA_MENSAJE: Partial<Record<string, string>> = {
  P2025: 'Recurso no encontrado',
  P2002: 'Ya existe un registro con ese valor único',
  P2003: 'La operación viola una relación con otro registro',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, mensaje } = this.resolver(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: mensaje,
    });
  }

  private resolver(exception: unknown): { status: HttpStatus; mensaje: string | string[] } {
    if (exception instanceof HttpException) {
      const respuestaExcepcion = exception.getResponse();
      const mensaje =
        typeof respuestaExcepcion === 'string'
          ? respuestaExcepcion
          : ((respuestaExcepcion as { message?: string | string[] })?.message ?? 'Error interno');
      return { status: exception.getStatus(), mensaje };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status = PRISMA_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const mensaje = PRISMA_MENSAJE[exception.code] ?? 'Error interno';
      return { status, mensaje };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, mensaje: 'Error interno' };
  }
}
