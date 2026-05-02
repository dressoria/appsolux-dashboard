import "@/lib/security/server-only";
import { evolutionFetch } from "./client";
import type { EvolutionQrResponse } from "@/types/evolution";

export async function getEvolutionQr(
  instanceName: string
): Promise<EvolutionQrResponse> {
  if (!instanceName) {
    throw new Error("instanceName is required");
  }

  return evolutionFetch<EvolutionQrResponse>(
    `/instance/connect/${instanceName}`
  );
}