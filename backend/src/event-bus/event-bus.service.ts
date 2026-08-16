import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NombreEvento } from './events';

// Envoltorio delgado sobre EventEmitter2: da a los módulos de negocio una
// API estable (emit/on) sin acoplarlos a la librería de eventos elegida.
@Injectable()
export class EventBusService {
  constructor(private readonly emitter: EventEmitter2) {}

  emit<T extends object>(evento: NombreEvento, payload: T): void {
    this.emitter.emit(evento, payload);
  }

  on<T extends object>(evento: NombreEvento, handler: (payload: T) => void | Promise<void>): void {
    this.emitter.on(evento, handler);
  }
}
