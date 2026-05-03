import "@/lib/security/server-only";
import { evolutionFetch } from "./client";
import type { EvolutionQrResponse } from "@/types/evolution";

type EvolutionRawQrResponse = {
  instance_name?: string;
  instanceName?: string;
  qr_code?: string;
  base64?: string;
  status?: string;
  pairingCode?: string;
  code?: string;
  count?: number;
  qrcode?: {
    base64?: string;
    code?: string;
    pairingCode?: string;
  };
};

type EvolutionConnectionStateResponse = {
  instance?: {
    state?: string;
  };
  state?: string;
  status?: string;
};

function normalizeEvolutionStatus(status?: string) {
  if (!status) {
    return "pending";
  }

  const normalized = status.toLowerCase();

  if (normalized === "open" || normalized === "connected") {
    return "connected";
  }

  if (normalized === "close" || normalized === "closed") {
    return "disconnected";
  }

  if (normalized === "connecting" || normalized === "created") {
    return "pending";
  }

  return "pending";
}

function normalizeQrResponse(
  instanceName: string,
  response: EvolutionRawQrResponse
): EvolutionQrResponse {
  return {
    instance_name:
      response.instance_name ?? response.instanceName ?? instanceName,
    qr_code: response.qr_code ?? response.code ?? response.qrcode?.code,
    base64: response.base64 ?? response.qrcode?.base64,
    status: normalizeEvolutionStatus(response.status),
  };
}

export async function getEvolutionQr(
  instanceName: string
): Promise<EvolutionQrResponse> {
  if (!instanceName) {
    throw new Error("instanceName is required");
  }

  const response = await evolutionFetch<EvolutionRawQrResponse>(
    `/instance/connect/${encodeURIComponent(instanceName)}`
  );

  return normalizeQrResponse(instanceName, response);
}

export async function getEvolutionConnectionState(instanceName: string) {
  if (!instanceName) {
    throw new Error("instanceName is required");
  }

  const response = await evolutionFetch<EvolutionConnectionStateResponse>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`
  );
  const state =
    response.instance?.state ?? response.state ?? response.status ?? "pending";

  return {
    instance_name: instanceName,
    status: normalizeEvolutionStatus(state),
    raw_status: state,
  };
}
