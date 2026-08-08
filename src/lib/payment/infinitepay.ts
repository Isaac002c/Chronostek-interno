import type { PaymentLinkRequest, PaymentProvider } from "./types";

export class InfinitePayProvider implements PaymentProvider {
  readonly name = "infinitepay";
  constructor(private readonly handle: string) {}

  private async post(path: string, body: unknown) {
    const response = await fetch(`https://api.checkout.infinitepay.io${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`INFINITEPAY_HTTP_${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  async createPaymentLink(input: PaymentLinkRequest) {
    if (!/^(1|true)$/i.test(process.env.INFINITEPAY_CREATE_LINKS_ENABLED ?? "false")) throw new Error("INFINITEPAY_CREATE_LINKS_DISABLED");
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("INVALID_PAYMENT_AMOUNT");
    const body = await this.post("/links", {
      handle: this.handle, redirect_url: input.redirectUrl, webhook_url: input.webhookUrl, order_nsu: input.orderId,
      items: [{ quantity: 1, price: input.amountCents, description: input.description }],
      customer: input.customer ? { name: input.customer.name, email: input.customer.email, phone_number: input.customer.phone } : undefined,
    });
    if (typeof body.url !== "string") throw new Error("INFINITEPAY_INVALID_RESPONSE");
    return { url: body.url };
  }

  async checkPayment(input: { orderId: string; transactionNsu: string; slug: string }) {
    const body = await this.post("/payment_check", { handle: this.handle, order_nsu: input.orderId, transaction_nsu: input.transactionNsu, slug: input.slug });
    return { paid: body.paid === true, amount: typeof body.amount === "number" ? body.amount : 0 };
  }
}

export function getInfinitePayProvider() {
  const handle = process.env.INFINITEPAY_HANDLE?.trim();
  return handle ? new InfinitePayProvider(handle) : null;
}
