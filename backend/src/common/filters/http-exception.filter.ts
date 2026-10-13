import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

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
  // Opcional: en tests unitarios de otros filtros/pipes se instancia este
  // filtro sin Prisma — el registro en ErrorLog es un extra, nunca debe
  // poder romper la respuesta de error que el cliente sí necesita.
  constructor(private readonly prisma?: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const { status, mensaje } = this.resolver(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(exception);
      this.registrarErrorLog(exception, request, status);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: mensaje,
    });
  }

  /**
   * Antes un 500 solo iba a console.error y se perdía al reiniciar el
   * contenedor — nadie dentro del tenant podía verlo (ver pantalla
   * "Auditoría y Logs" en Configuración). Solo se escribe si el request
   * venía autenticado como tenant (igual criterio que AuditLogInterceptor);
   * fire-and-forget, nunca debe bloquear ni poder tumbar la respuesta real.
   */
  private registrarErrorLog(exception: unknown, request: AuthenticatedRequest, status: HttpStatus) {
    const tenantId = request.user?.tenantId;
    if (!tenantId || !this.prisma) return;

    this.prisma.errorLog
      .create({
        data: {
          tenantId,
          userId: request.user.userId,
          metodo: request.method,
          ruta: request.url,
          statusCode: status,
          mensaje: exception instanceof Error ? exception.message : 'Error interno',
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      })
      .catch((error) => {
        console.error('No se pudo escribir el error log', error);
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

    // body-parser (Express) rechaza el request ANTES de que llegue a
    // cualquier controller/DTO — nunca es una HttpException, así que sin
    // este caso cae al 500 genérico de abajo (bug real: un producto con
    // varias fotos tiraba "Error interno" en vez de un mensaje claro).
    if ((exception as { type?: string })?.type === 'entity.too.large') {
      return { status: HttpStatus.PAYLOAD_TOO_LARGE, mensaje: 'Los datos enviados son demasiado pesados — probá con menos archivos o imágenes más livianas' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, mensaje: 'Error interno' };
  }
}
