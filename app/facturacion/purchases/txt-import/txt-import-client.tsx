"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ImportResultRow = {
  accessKey: string;
  emitterRuc: string;
  emitterName: string;
  documentType: string;
  status: "imported" | "already_exists" | "soap_failed" | "import_failed";
  error?: string;
};

type ImportSummary = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
};

type ImportResponse = {
  ok: boolean;
  error?: string;
  summary?: ImportSummary;
  results?: ImportResultRow[];
};

export function TxtImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResponse(null);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/purchases/txt-import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResponse = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error desconocido.");
      } else {
        setResponse(data);
      }
    } catch {
      setError("Error de red al subir el archivo.");
    } finally {
      setUploading(false);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResponse(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const statusLabel = (status: ImportResultRow["status"]) => {
    switch (status) {
      case "imported": return "Importado";
      case "already_exists": return "Ya existe";
      case "soap_failed": return "XML no disponible";
      case "import_failed": return "Error";
    }
  };

  const statusColor = (status: ImportResultRow["status"]) => {
    switch (status) {
      case "imported": return "text-green-700 dark:text-green-400";
      case "already_exists": return "text-yellow-700 dark:text-yellow-400";
      case "soap_failed": return "text-orange-700 dark:text-orange-400";
      case "import_failed": return "text-red-700 dark:text-red-400";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar comprobantes recibidos (TXT)</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Suba el archivo TXT descargado desde el portal del SRI con los comprobantes recibidos.
          El sistema obtendrá automáticamente el XML de cada comprobante desde el servicio SOAP del SRI
          y lo registrará como documento de compra. Máximo 50 comprobantes por importación;
          si su archivo tiene más filas, divídalo en partes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Cómo obtener el archivo TXT:</p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
              <li>Ingrese al portal del SRI en <span className="font-mono text-xs">srienlinea.sri.gob.ec</span></li>
              <li>Navegue a Comprobantes Electrónicos Recibidos</li>
              <li>Complete el reCAPTCHA y realice la consulta del período deseado</li>
              <li>Haga clic en &quot;Descargar TXT&quot; para obtener el archivo</li>
              <li>Suba el archivo TXT aquí</li>
            </ol>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.tsv,text/plain,text/tab-separated-values"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
            />
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Importando..." : "Importar"}
            </Button>
          </div>

          {file && !uploading && !response && (
            <p className="text-sm text-gray-500">
              Archivo seleccionado: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {response?.summary && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Resultado de la importación</h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
                <p className="text-2xl font-bold">{response.summary.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{response.summary.imported}</p>
                <p className="text-xs text-gray-500">Importados</p>
              </div>
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{response.summary.skipped}</p>
                <p className="text-xs text-gray-500">Ya existían</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{response.summary.failed}</p>
                <p className="text-xs text-gray-500">Errores</p>
              </div>
            </div>

            {response.results && response.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500 uppercase">
                      <th className="pb-2 pr-3">RUC Emisor</th>
                      <th className="pb-2 pr-3">Emisor</th>
                      <th className="pb-2 pr-3">Tipo</th>
                      <th className="pb-2 pr-3">Estado</th>
                      <th className="pb-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.results.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3 font-mono text-xs">{row.emitterRuc || "—"}</td>
                        <td className="py-2 pr-3 truncate max-w-[200px]">{row.emitterName || "—"}</td>
                        <td className="py-2 pr-3">{row.documentType || "—"}</td>
                        <td className={`py-2 pr-3 font-medium ${statusColor(row.status)}`}>
                          {statusLabel(row.status)}
                        </td>
                        <td className="py-2 text-xs text-gray-500">{row.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleReset}>
                Importar otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
