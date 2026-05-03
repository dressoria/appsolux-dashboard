import type { ReactNode } from "react";

type ErpSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ErpSection({ title, description, children }: ErpSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
