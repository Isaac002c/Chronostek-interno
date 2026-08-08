export type PaymentLinkRequest = {
  orderId: string;
  redirectUrl: string;
  webhookUrl: string;
  description: string;
  amountCents: number;
  customer?: { name?: string; email?: string; phone?: string };
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(input: PaymentLinkRequest): Promise<{ url: string }>;
  checkPayment(input: { orderId: string; transactionNsu: string; slug: string }): Promise<{ paid: boolean; amount: number }>;
}
