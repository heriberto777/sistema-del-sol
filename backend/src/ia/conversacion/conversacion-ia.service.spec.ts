import { ConversacionIaService } from './conversacion-ia.service';
import { ClaudeConversacionAdapter } from './claude-conversacion.adapter';
import { OpenAiConversacionAdapter } from './openai-conversacion.adapter';
import { GeminiConversacionAdapter } from './gemini-conversacion.adapter';

describe('ConversacionIaService', () => {
  let service: ConversacionIaService;
  let claudeAdapter: jest.Mocked<ClaudeConversacionAdapter>;
  let openAiAdapter: jest.Mocked<OpenAiConversacionAdapter>;
  let geminiAdapter: jest.Mocked<GeminiConversacionAdapter>;

  beforeEach(() => {
    claudeAdapter = { clave: 'ANTHROPIC', completar: jest.fn().mockResolvedValue('respuesta-claude') } as unknown as jest.Mocked<ClaudeConversacionAdapter>;
    openAiAdapter = { clave: 'OPENAI', completar: jest.fn().mockResolvedValue('respuesta-openai') } as unknown as jest.Mocked<OpenAiConversacionAdapter>;
    geminiAdapter = { clave: 'GEMINI', completar: jest.fn().mockResolvedValue('respuesta-gemini') } as unknown as jest.Mocked<GeminiConversacionAdapter>;
    service = new ConversacionIaService(claudeAdapter, openAiAdapter, geminiAdapter);
  });

  it('resuelve OpenAI cuando el tenant eligió OPENAI', async () => {
    const resultado = await service.completar('OPENAI', [{ role: 'user', content: 'hola' }], { apiKey: 'x' });
    expect(resultado).toBe('respuesta-openai');
    expect(openAiAdapter.completar).toHaveBeenCalled();
    expect(claudeAdapter.completar).not.toHaveBeenCalled();
  });

  it('resuelve Gemini cuando el tenant eligió GEMINI', async () => {
    const resultado = await service.completar('GEMINI', [{ role: 'user', content: 'hola' }], { apiKey: 'x' });
    expect(resultado).toBe('respuesta-gemini');
    expect(geminiAdapter.completar).toHaveBeenCalled();
  });

  it('un proveedor vacío/null cae a Claude (mismo comportamiento que antes de que el selector tuviera efecto)', async () => {
    const resultado = await service.completar(null, [{ role: 'user', content: 'hola' }], { apiKey: 'x' });
    expect(resultado).toBe('respuesta-claude');
    expect(claudeAdapter.completar).toHaveBeenCalled();
  });

  it('un proveedor desconocido cae a Claude en vez de romper', async () => {
    const resultado = await service.completar('VERCEL', [{ role: 'user', content: 'hola' }], { apiKey: 'x' });
    expect(resultado).toBe('respuesta-claude');
    expect(claudeAdapter.completar).toHaveBeenCalled();
  });
});
