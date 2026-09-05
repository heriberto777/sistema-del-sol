export interface MensajeConversacion {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpcionesConversacionIa {
  /** Del tenant (`WhatsappConfigTenant.iaApiKeyCifrado`, ya descifrada por quien llama) — nunca cae a una key de plataforma. */
  apiKey: string;
  modelo?: string;
  maxTokens?: number;
  /** Prompt de sistema — cada proveedor lo manda por su propio mecanismo (campo separado en Claude/Gemini, mensaje "system" en OpenAI). */
  system?: string;
}

/** Un adaptador por proveedor de IA conversacional — mismo criterio que AnalizadorImagenAdapter, pero la key viene del tenant en cada llamada, no de `process.env`. */
export interface ConversacionIaAdapter {
  readonly clave: string;
  /** `null` en cualquier falla (key inválida, proveedor caído, respuesta vacía) — nunca lanza, el bot cae a su heurística sin IA. */
  completar(mensajes: MensajeConversacion[], opciones: OpcionesConversacionIa): Promise<string | null>;
}
