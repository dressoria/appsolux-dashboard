import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { getPrismaClient } from "@/lib/db/prisma";
import { currentLegalRelease, contentHash } from "@/lib/legal/service";
import { legalDocuments } from "@/lib/legal/catalog";
import { PublicFooter } from "./public-footer";
import styles from "./legal-document-page.module.css";

type TocEntry = { id: string; text: string };

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseSections(content: string) {
  const toc: TocEntry[] = [];
  const lines = content.split("\n");
  const elements: Array<{ type: "h2" | "h3" | "p" | "li"; id?: string; text: string }> = [];
  let buffer: string[] = [];

  function flushBuffer() {
    if (buffer.length === 0) return;
    const text = buffer.join("\n").trim();
    if (text) elements.push({ type: "p", text });
    buffer = [];
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushBuffer();
      const text = line.slice(3).trim();
      const id = slugify(text);
      toc.push({ id, text });
      elements.push({ type: "h2", id, text });
    } else if (line.startsWith("### ")) {
      flushBuffer();
      elements.push({ type: "h3", text: line.slice(4).trim() });
    } else if (/^[-•]\s/.test(line)) {
      flushBuffer();
      elements.push({ type: "li", text: line.replace(/^[-•]\s/, "").trim() });
    } else if (line.trim() === "") {
      flushBuffer();
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  return { toc, elements };
}

const seoDescriptions: Record<string, string> = {
  terms: "Términos y Condiciones de uso de Facturom, plataforma de facturación electrónica para Ecuador.",
  privacy: "Política de Privacidad de Facturom. Información sobre tratamiento de datos personales conforme a la LOPDP de Ecuador.",
  payments: "Condiciones de Pagos y Suscripciones de Facturom. Planes, precios, renovación y cancelación.",
  dpa: "Acuerdo de Tratamiento de Datos de Facturom para empresas clientes en Ecuador.",
  cookies: "Política de Cookies de Facturom. Tecnologías de almacenamiento utilizadas y preferencias.",
  refunds: "Política de Reembolsos de Facturom. Procedimiento para solicitudes de cancelación y devolución.",
};

export function legalPageMetadata(type: string): Metadata {
  const spec = legalDocuments.find((doc) => doc.type === type)!;
  return {
    title: `${spec.title} — Facturom`,
    description: seoDescriptions[type] ?? `${spec.title} de Facturom.`,
    openGraph: {
      title: `${spec.title} — Facturom`,
      description: seoDescriptions[type] ?? `${spec.title} de Facturom.`,
      url: `https://facturom.com/${spec.slug}`,
      siteName: "Facturom",
      locale: "es_EC",
      type: "article",
    },
    alternates: { canonical: `https://facturom.com/${spec.slug}` },
  };
}

export function legalDocumentPage(type: string) {
  return async function LegalDocumentPage({
    searchParams,
  }: {
    searchParams: Promise<{ version?: string }>;
  }) {
    const { version } = await searchParams;
    const spec = legalDocuments.find((doc) => doc.type === type)!;

    let document: {
      version: string;
      content: string;
      hash: string;
      effectiveAt: Date;
    } | null = null;

    try {
      document = version
        ? await getPrismaClient().legalDocumentVersion.findFirst({
            where: {
              type,
              version,
              status: { in: ["PUBLISHED", "REPLACED"] },
              release: { status: { in: ["PUBLISHED", "REPLACED"] } },
            },
          })
        : ((await currentLegalRelease()).documents.find(
            (doc) => doc.type === type,
          ) ?? null);
      if (document && document.hash !== contentHash(document.content))
        document = null;
    } catch {
      /* No published release or incomplete operator identity. */
    }

    const parsed = document ? parseSections(document.content) : null;

    return (
      <div className={styles.page}>
        {/* Sticky header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link
              href="/"
              className="text-lg font-black tracking-tight"
              style={{ color: "#000345" }}
            >
              Facturom
            </Link>
            <Link
              href="/precios"
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "#1769E0" }}
            >
              Ver planes
            </Link>
          </div>
        </header>

        {/* Main content */}
        <div className={styles.main}>
          {/* Desktop TOC sidebar */}
          {parsed && parsed.toc.length > 0 ? (
            <aside className={styles.toc} aria-label="Índice">
              <p className={styles.tocTitle}>Contenido</p>
              <ul className={styles.tocList}>
                {parsed.toc.map((entry) => (
                  <li key={entry.id}>
                    <a href={`#${entry.id}`} className={styles.tocLink}>
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : (
            <div />
          )}

          {/* Article */}
          <article className={styles.article}>
            <h1 className={styles.articleTitle}>{spec.title}</h1>

            {document ? (
              <>
                <div className={styles.meta}>
                  <span>Versión {document.version}</span>
                  <span>
                    Vigente desde{" "}
                    {document.effectiveAt.toISOString().slice(0, 10)}
                  </span>
                </div>

                {/* Mobile TOC */}
                {parsed && parsed.toc.length > 0 ? (
                  <MobileToc toc={parsed.toc} />
                ) : null}

                {/* Rendered content */}
                <div className={styles.content}>
                  <RenderedSections elements={parsed!.elements} />
                </div>

                <p className={styles.integrity}>SHA-256: {document.hash}</p>
              </>
            ) : (
              <div className={styles.pendingBox}>
                <FileText
                  className="mx-auto mb-4"
                  size={32}
                  style={{ color: "#000345" }}
                />
                <p className={styles.pendingTitle}>
                  {version
                    ? "Versión no disponible"
                    : "Documento en preparación"}
                </p>
                <p className={styles.pendingText}>
                  {version
                    ? "Esta versión no está publicada o no está disponible."
                    : "Las condiciones están pendientes de revisión jurídica y publicación. La contratación de nuevos servicios aún no está habilitada."}
                </p>
                <Link href="/contacto" className={styles.pendingContact}>
                  Contactar soporte
                </Link>
              </div>
            )}

            {/* Cross-links to other legal docs */}
            <nav aria-label="Documentos legales" className={styles.crossLinks}>
              {legalDocuments.map((doc) => (
                <Link
                  key={doc.type}
                  href={`/${doc.slug}`}
                  className={
                    doc.type === type
                      ? `${styles.crossLink} ${styles.crossLinkActive}`
                      : styles.crossLink
                  }
                >
                  {doc.title}
                </Link>
              ))}
            </nav>
          </article>
        </div>

        <PublicFooter />
      </div>
    );
  };
}

function RenderedSections({
  elements,
}: {
  elements: Array<{
    type: "h2" | "h3" | "p" | "li";
    id?: string;
    text: string;
  }>;
}) {
  const result: React.ReactNode[] = [];
  let listItems: Array<{ key: number; text: string }> = [];

  function flushList() {
    if (listItems.length === 0) return;
    result.push(
      <ul key={`list-${listItems[0].key}`}>
        {listItems.map((item) => (
          <li key={item.key}>{item.text}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === "li") {
      listItems.push({ key: i, text: el.text });
      continue;
    }
    flushList();
    if (el.type === "h2") {
      result.push(
        <h2 key={i} id={el.id}>
          {el.text}
        </h2>,
      );
    } else if (el.type === "h3") {
      result.push(<h3 key={i}>{el.text}</h3>);
    } else {
      result.push(<p key={i}>{el.text}</p>);
    }
  }
  flushList();

  return <>{result}</>;
}

function MobileToc({ toc }: { toc: TocEntry[] }) {
  return (
    <details className={styles.mobileToc}>
      <summary className={styles.mobileTocButton}>Índice del documento</summary>
      <ul className={styles.mobileTocList}>
        {toc.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={styles.mobileTocLink}>
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
