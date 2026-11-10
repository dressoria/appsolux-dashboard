import Link from "next/link";
import { getPrismaClient } from "@/lib/db/prisma";
import { currentLegalRelease, contentHash } from "@/lib/legal/service";
import { legalDocuments } from "@/lib/legal/catalog";
import { PublicFooter } from "./public-footer";

export function legalDocumentPage(type: string) {
  return async function LegalDocumentPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
    const { version } = await searchParams;
    const spec = legalDocuments.find((doc) => doc.type === type)!;
    let document = null;
    try {
      document = version
        ? await getPrismaClient().legalDocumentVersion.findFirst({ where: { type, version, status: { in: ["PUBLISHED", "REPLACED"] }, release: { status: { in: ["PUBLISHED", "REPLACED"] } } } })
        : (await currentLegalRelease()).documents.find((doc) => doc.type === type) ?? null;
      if (document && document.hash !== contentHash(document.content)) document = null;
    } catch { /* No drafts or incomplete operator identity are exposed. */ }
    return <><main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-12">
      <Link href="/" className="font-bold text-facturom-primary">Facturom</Link>
      <h1 className="text-3xl font-bold">{spec.title}</h1>
      {document ? <><p className="text-sm text-muted-foreground">Versión {document.version} · Vigente desde {document.effectiveAt.toISOString().slice(0, 10)}</p><article className="whitespace-pre-wrap break-words leading-7">{document.content}</article><p className="break-all text-xs text-muted-foreground">SHA-256: {document.hash}</p></> : <p role="status">{version ? "Esta versión no está publicada o no está disponible." : "Las condiciones están pendientes de revisión y publicación. La contratación de nuevos servicios aún no está habilitada. Puedes consultar soporte desde Contacto."}</p>}
      <nav aria-label="Documentos legales" className="flex flex-wrap gap-4 text-sm underline">{legalDocuments.map((doc) => <Link key={doc.type} href={`/${doc.slug}`}>{doc.title}</Link>)}</nav>
    </main><PublicFooter /></>;
  };
}
