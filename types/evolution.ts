import type { ChannelStatus } from "./tenant";

export type EvolutionInstance = {
  instance_name: string;
  status: ChannelStatus;
};

export type EvolutionQrResponse = {
  instance_name: string;
  qr_code?: string;
  base64?: string;
  status: ChannelStatus;
};