"use client";

import { useEffect, useState } from "react";

type Member = { id: string; name: string | null; email: string | null };

type Props = {
  name: string;
  value: string;
  onChange: (id: string) => void;
  label: string;
  emptyLabel?: string;
};

export function TenantUserSelect({
  name,
  value,
  onChange,
  label,
  emptyLabel = "Sin asignar",
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/basic/tenant-members")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.members)) {
          setMembers(data.members);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
    >
      <option value="">{emptyLabel}</option>
      {!loaded && value && (
        <option value={value}>Cargando...</option>
      )}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name ?? m.email ?? m.id}
        </option>
      ))}
    </select>
  );
}
