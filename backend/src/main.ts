import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // rawBody: true deja request.rawBody (Buffer) disponible en TODAS las
  // rutas sin desactivar el parseo JSON normal del resto de la app — lo
  // único que necesita el webhook de Stripe para verificar la firma
  // (exige el body crudo, no el ya parseado a objeto).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // useBodyParser() ANTES de que Nest registre su parser default (eso
  // pasa recién al bindear el server, así que llegar primero alcanza
  // para reemplazarlo) — el límite de Express/body-parser es 100kb por
  // defecto, insuficiente para el patrón de este proyecto (fotos de
  // producto/logos/documentos como data URI dentro del body JSON, no
  // multipart). Bug real: agregar varias fotos a un producto tiraba 413
  // "PayloadTooLargeError", enmascarado como 500 genérico por
  // HttpExceptionFilter. Respeta rawBody automáticamente (ver doc de
  // NestExpressApplication.useBodyParser), no hace falta bodyParser:false.
  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '15mb' });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('El Sistema del Sol')
    .setDescription('API de la plataforma SaaS de facturación modular')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT ?? 3000;
  await app.listen(port);
  console.log(`API corriendo en http://localhost:${port}/api`);
  console.log(`Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
