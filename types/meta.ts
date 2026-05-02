import type { ChannelStatus } from "./tenant";

export type MetaChannelType = "whatsapp" | "instagram" | "messenger";

export type MetaConnectionStatus = {
  channel: MetaChannelType;
  status: ChannelStatus;
  external_id?: string;
};