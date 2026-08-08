export type OutboundMessage = {
  tenantId: string;
  prospectId: string;
  message: string;
  agentId?: string;
  approvedTemplate?: string;
};

export type ProviderSendResult = { providerMessageId: string; rawStatus?: string };

export interface WhatsAppProvider {
  readonly name: string;
  sendText(number: string, text: string): Promise<ProviderSendResult>;
  healthCheck(): Promise<{ online: boolean; detail: string }>;
}
