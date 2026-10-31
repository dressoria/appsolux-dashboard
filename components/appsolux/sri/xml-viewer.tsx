"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type XmlViewerProps = {
  xml: string;
  title?: string;
  accessKey?: string | null;
};

function formatXml(xml: string): string {
  let formatted = "";
  let indent = 0;
  const lines = xml.replace(/>\s*</g, ">\n<").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("</")) indent = Math.max(0, indent - 1);
    formatted += "  ".repeat(indent) + line + "\n";
    if (line.startsWith("<") && !line.startsWith("</") && !line.startsWith("<?") && !line.endsWith("/>") && !line.includes("</")) {
      indent++;
    }
  }
  return formatted.trim();
}

function highlightXml(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="text-rose-600 dark:text-rose-400">$2</span>')
    .replace(/([\w:.-]+)(=)/g, '<span class="text-amber-700 dark:text-amber-400">$1</span>$2')
    .replace(/(".*?")/g, '<span class="text-emerald-700 dark:text-emerald-400">$1</span>')
    .replace(/(&lt;\?.*?\?&gt;)/g, '<span class="text-slate-500">$1</span>');
}

export function XmlViewer({ xml, title, accessKey }: XmlViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatted = formatXml(xml);
  const preview = formatted.slice(0, 2000);
  const isLong = formatted.length > 2000;

  function copyToClipboard() {
    navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-medium">{title}</h3>}
      {accessKey && (
        <p className="text-xs text-muted-foreground font-mono">
          Clave de acceso: {accessKey}
        </p>
      )}
      <div className="relative rounded-md border bg-muted/30 overflow-hidden">
        <div className="flex items-center justify-end gap-2 p-2 border-b bg-muted/50">
          <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 text-xs">
            {copied ? "Copiado" : "Copiar XML"}
          </Button>
        </div>
        <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono max-h-[600px] overflow-y-auto">
          <code
            dangerouslySetInnerHTML={{
              __html: highlightXml(expanded || !isLong ? formatted : preview + "\n..."),
            }}
          />
        </pre>
        {isLong && !expanded && (
          <div className="border-t p-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="text-xs">
              Mostrar XML completo ({Math.round(formatted.length / 1024)}KB)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
