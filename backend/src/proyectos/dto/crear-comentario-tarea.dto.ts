import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// 20000 (no 2000) a propósito: el placeholder del formulario invita a
// pegar bloques de código, y en la práctica también se pegan logs o
// resultados de consultas — un límite corto rechazaba ese uso real con
// un 400 sin aviso previo en el formulario (bug real, reportado por el
// usuario). `contenido` es `@db.Text` en Postgres, sin límite propio.
const LARGO_MAXIMO_COMENTARIO = 20000;

export class CrearComentarioTareaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LARGO_MAXIMO_COMENTARIO, { message: `El comentario no puede superar los ${LARGO_MAXIMO_COMENTARIO} caracteres.` })
  contenido: string;
}

export { LARGO_MAXIMO_COMENTARIO };
