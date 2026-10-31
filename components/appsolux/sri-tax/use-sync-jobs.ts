"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { selectVisibleSyncJob, type SyncJobView } from "@/lib/core/sri-sync-presentation";

export function useSyncJobs(endpoint: string) {
  const [jobs, setJobs] = useState<SyncJobView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error ?? "No se pudo consultar el estado de los trabajos.");
      if (!controller.signal.aborted) { setJobs(data.jobs ?? data.items ?? []); setError(null); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); requestRef.current?.abort(); };
  }, [refresh]);
  const trackJob = useCallback((job: SyncJobView) => {
    requestRef.current?.abort();
    setJobs((previous) => [job, ...previous.filter((item) => item.id !== job.id)]);
    setLoading(false);
  }, []);
  return { jobs, job: selectVisibleSyncJob(jobs), loading, error, refresh, trackJob };
}
