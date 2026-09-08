import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PublicacionesSocialesService } from './publicaciones-sociales.service';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { GeneradorFondoService } from '../ia/generador-fondo/generador-fondo.service';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarImagenPublicacionSocial } from './generador-imagen-publicacion-social';

jest.mock('../common/impresion/resolver-personalizacion-documento');
jest.mock('./generador-imagen-publicacion-social');

const PRODUCTO_CON_PRECIO = {
  id: 'prod1',
  nombre: 'Yogurt Fresa',
  imagen: 'data:image/jpeg;base64,AAAA',
  variantes: [{ precios: [{ precioVenta: 100 }] }],
};
const PLANTILLA_ACTIVA = { id: 'pl1', clave: 'minimalista', nombre: 'Minimalista', activa: true };

describe('PublicacionesSocialesService', () => {
  let service: PublicacionesSocialesService;
  let repo: jest.Mocked<PublicacionesSocialesRepository>;
  let whatsappConfigRepository: jest.Mocked<WhatsappConfigRepository>;
  let generadorFondoService: jest.Mocked<GeneradorFondoService>;

  beforeEach(() => {
    repo = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      buscarProductoParaGenerar: jest.fn(),
      buscarPlantillaPorId: jest.fn(),
      listarPlantillasActivas: jest.fn(),
      contarGeneracionesIaDelMes: jest.fn(),
      buscarLimiteIaFondo: jest.fn(),
    } as unknown as jest.Mocked<PublicacionesSocialesRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn(), actualizar: jest.fn() } as unknown as jest.Mocked<WhatsappConfigRepository>;
    generadorFondoService = { generarDesdeDataUri: jest.fn(), listarModelos: jest.fn() } as unknown as jest.Mocked<GeneradorFondoService>;
    const prisma = {} as PrismaService;
    service = new PublicacionesSocialesService(repo, prisma, whatsappConfigRepository, generadorFondoService);

    jest.mocked(resolverPersonalizacionDocumento).mockResolvedValue({ logo: undefined, notaPie: undefined });
    jest.mocked(generarImagenPublicacionSocial).mockResolvedValue('data:image/png;base64,BANNER');
    repo.buscarProductoParaGenerar.mockResolvedValue(PRODUCTO_CON_PRECIO as never);
    repo.buscarPlantillaPorId.mockResolvedValue(PLANTILLA_ACTIVA as never);
    repo.crear.mockResolvedValue({ id: 'nueva' } as never);
  });

  describe('crear', () => {
    it('sin promptIa: no llama a la IA, guarda origen FOTO_PRODUCTO', async () => {
      await service.crear({ productoId: 'prod1', plantillaId: 'pl1' }, 't1', 'u1');

      expect(generadorFondoService.generarDesdeDataUri).not.toHaveBeenCalled();
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'FOTO_PRODUCTO', promptIa: null }));
    });

    it('con promptIa: genera el fondo con IA y guarda origen IA', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(2);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);
      generadorFondoService.generarDesdeDataUri.mockResolvedValue('data:image/png;base64,FONDO_IA');

      await service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'fondo de cocina moderna' }, 't1', 'u1');

      expect(generadorFondoService.generarDesdeDataUri).toHaveBeenCalledWith(PRODUCTO_CON_PRECIO.imagen, 'fondo de cocina moderna');
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'IA', promptIa: 'fondo de cocina moderna' }));
    });

    it('rechaza si ya alcanzó el límite mensual de generaciones con IA', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(20);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);

      await expect(
        service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'otro fondo' }, 't1', 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(generadorFondoService.generarDesdeDataUri).not.toHaveBeenCalled();
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('enviarAAprobacion', () => {
    it('pasa de BORRADOR a PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await service.enviarAAprobacion('p1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith('p1', { estado: 'PENDIENTE_APROBACION' });
    });

    it('rechaza si la publicación no está en BORRADOR', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarAAprobacion('p1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('aprueba una publicación PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'APROBADA' } as never);

      await service.cambiarEstado('p1', 'APROBADA', 'u1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'APROBADA', aprobadoPorId: 'u1' }),
      );
    });

    it('rechaza con motivo obligatorio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });

    it('rechaza con motivo en blanco igual que sin motivo', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('acepta un rechazo con motivo real', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'RECHAZADA' } as never);

      await service.cambiarEstado('p1', 'RECHAZADA', 'u1', 'La foto sale borrosa');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'RECHAZADA', motivoRechazo: 'La foto sale borrosa' }),
      );
    });

    it('no permite aprobar/rechazar una publicación que no está PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await expect(service.cambiarEstado('p1', 'APROBADA', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enviarPorWhatsapp', () => {
    it('rechaza si la publicación no está APROBADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(BadRequestException);
      expect(whatsappConfigRepository.obtenerOCrear).not.toHaveBeenCalled();
    });

    it('degrada con un error claro si el tenant no configuró Twilio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'APROBADA', producto: { nombre: 'Yogurt Fresa' } } as never);
      whatsappConfigRepository.obtenerOCrear.mockResolvedValue({} as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
