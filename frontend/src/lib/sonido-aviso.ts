/**
 * Beep corto sintetizado con la Web Audio API nativa — sin archivo de
 * audio externo. Usado por `BandejaWhatsappWidget` para el aviso de un
 * mensaje nuevo que necesita atención humana.
 *
 * Los navegadores bloquean audio sin interacción previa del usuario en la
 * pestaña — en un admin donde siempre se está clickeando algo esto rara
 * vez es un problema, pero puede fallar en pestañas recién abiertas sin
 * ninguna interacción todavía. Nunca lanza: un fallo acá no debe romper
 * el resto del aviso (el toast visual sigue funcionando igual).
 */
export function reproducirAvisoSonoro() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(880, ctx.currentTime);
    ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start();
    oscilador.stop(ctx.currentTime + 0.35);
    oscilador.onended = () => ctx.close();
  } catch {
    // El sonido es un plus, no algo crítico — si falla, el toast visual alcanza.
  }
}
