import { NotFoundException } from '@nestjs/common';
import { ProductoImagenPublicaService } from './producto-imagen-publica.service';

describe('ProductoImagenPublicaService', () => {
  let service: ProductoImagenPublicaService;
  let prisma: { producto: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { producto: { findUnique: jest.fn() } };
    service = new ProductoImagenPublicaService(prisma as never);
  });

  it('decodifica el data URI y devuelve el buffer con el content-type correcto', async () => {
    const base64 = Buffer.from('contenido-fake-de-imagen').toString('base64');
    prisma.producto.findUnique.mockResolvedValue({ imagen: `data:image/png;base64,${base64}` });

    const resultado = await service.obtenerImagen('p1');

    expect(resultado.contentType).toBe('image/png');
    expect(resultado.buffer.toString()).toBe('contenido-fake-de-imagen');
  });

  it('normaliza jpg a image/jpeg', async () => {
    const base64 = Buffer.from('x').toString('base64');
    prisma.producto.findUnique.mockResolvedValue({ imagen: `data:image/jpg;base64,${base64}` });

    const resultado = await service.obtenerImagen('p1');

    expect(resultado.contentType).toBe('image/jpeg');
  });

  it('404 si el producto no existe', async () => {
    prisma.producto.findUnique.mockResolvedValue(null);
    await expect(service.obtenerImagen('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('404 si el producto no tiene imagen', async () => {
    prisma.producto.findUnique.mockResolvedValue({ imagen: null });
    await expect(service.obtenerImagen('p1')).rejects.toThrow(NotFoundException);
  });

  it('404 si el campo imagen no es un data URI válido', async () => {
    prisma.producto.findUnique.mockResolvedValue({ imagen: 'no-es-una-data-uri' });
    await expect(service.obtenerImagen('p1')).rejects.toThrow(NotFoundException);
  });
});
