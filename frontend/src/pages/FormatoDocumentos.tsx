import { FormatoDocumentosPanel } from '../components/organisms/FormatoDocumentosPanel/FormatoDocumentosPanel';

export function FormatoDocumentos() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Formato de Documentos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Color de marca, datos visibles, columnas, texto legal, QR y firma de Factura, Cotización y Remisión.
        </p>
      </div>

      <FormatoDocumentosPanel />
    </div>
  );
}
