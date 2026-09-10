import { useState } from 'react';
import { Calculator } from 'lucide-react';

export function CalculadoraHipoteca({ precio, simbolo }: { precio: number; simbolo: string }) {
  const [inicialPct, setInicialPct] = useState(20);
  const [tasaAnual, setTasaAnual] = useState(12);
  const [anios, setAnios] = useState(20);

  const inicial = precio * (inicialPct / 100);
  const monto = precio - inicial;
  const tasaMensual = tasaAnual / 100 / 12;
  const numeroPagos = anios * 12;
  const cuotaMensual =
    tasaMensual === 0 || monto <= 0
      ? monto / Math.max(numeroPagos, 1)
      : (monto * tasaMensual * Math.pow(1 + tasaMensual, numeroPagos)) / (Math.pow(1 + tasaMensual, numeroPagos) - 1);

  function formatear(n: number) {
    return `${simbolo} ${Math.round(n).toLocaleString('es-DO')}`;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <Calculator size={16} />
        <h3 className="font-semibold">Calculadora de hipoteca</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">Estimado, sujeto a la aprobación y condiciones de tu banco.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-500">
          Inicial ({inicialPct}%)
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={inicialPct}
            onChange={(e) => setInicialPct(Number(e.target.value))}
            className="mt-1 block w-full"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Tasa anual (%)
          <input
            type="number"
            min={0}
            max={40}
            step={0.1}
            value={tasaAnual}
            onChange={(e) => setTasaAnual(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Plazo (años)
          <input
            type="number"
            min={1}
            max={30}
            value={anios}
            onChange={(e) => setAnios(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Inicial</p>
          <p className="font-semibold text-slate-900">{formatear(inicial)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Monto a financiar</p>
          <p className="font-semibold text-slate-900">{formatear(monto)}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-3">
          <p className="text-xs text-teal-700">Cuota mensual est.</p>
          <p className="font-semibold text-teal-800">{formatear(cuotaMensual)}</p>
        </div>
      </div>
    </div>
  );
}
