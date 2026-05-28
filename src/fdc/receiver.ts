import { detectPackageType, parsePackage } from "./parse.js";
import { buildAck } from "./response.js";
import { FdcErrorCode } from "./types.js";
import type {
  FdcAck,
  FdcContext,
  FdcPackageType,
  OutgoingInvoice,
  IncomingInvoice,
  BankTransaction,
  Receipt,
} from "./types.js";

type MaybePromise<T> = T | Promise<T>;

const KEY_HEADER = "x-szamlazzhu-key";

export interface FdcHandlers {
  onOutgoingInvoice?(
    invoice: OutgoingInvoice,
    ctx: FdcContext,
  ): MaybePromise<FdcAck | void>;
  onIncomingInvoice?(
    invoice: IncomingInvoice,
    ctx: FdcContext,
  ): MaybePromise<FdcAck | void>;
  onBankTransaction?(
    transaction: BankTransaction,
    ctx: FdcContext,
  ): MaybePromise<FdcAck | void>;
  onReceipt?(receipt: Receipt, ctx: FdcContext): MaybePromise<FdcAck | void>;
}

export interface FinancialDataReceiverOptions {
  /**
   * Expected identification key(s) (`X-Szamlazzhu-Key`). When set, requests
   * with a non-matching key are acknowledged with `KEY_ERR`. Omit to skip
   * verification, or provide {@link verifyKey} for custom logic.
   */
  key?: string | string[];
  /** Custom key verification (overrides {@link key}). */
  verifyKey?: (key: string | undefined) => MaybePromise<boolean>;
  handlers: FdcHandlers;
  /**
   * When a package type has no registered handler, acknowledge it as received
   * (HTTP 200) so Szamlazz.hu does not keep resubmitting. Defaults to `true`.
   */
  acknowledgeUnhandled?: boolean;
}

export interface FdcHandleInput {
  body: string;
  headers?: Record<string, string | string[] | undefined> | Headers;
}

export interface FdcHandleResult {
  status: number;
  contentType: string;
  body: string;
  packageType?: FdcPackageType;
}

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";

/**
 * Receives and acknowledges Szamlazz.hu Financial Data Connection (Penzugyi
 * adatkapcsolat) PUSH packages. Framework-agnostic: feed it the raw request
 * body and headers via {@link handle}, or a Fetch `Request` via
 * {@link webHandler}.
 */
export class FinancialDataReceiver {
  constructor(private readonly options: FinancialDataReceiverOptions) {}

  /** Core handler: parse, verify, dispatch, and build the acknowledgment. */
  async handle(input: FdcHandleInput): Promise<FdcHandleResult> {
    const key = getHeader(input.headers, KEY_HEADER);
    const packageType = detectPackageType(input.body);

    if (!packageType) {
      return { status: 400, contentType: "text/plain", body: "Unknown package" };
    }

    const pkg = parsePackage(input.body);
    const ctx: FdcContext = { key, packageType, rawBody: input.body };

    if (!(await this.verify(key))) {
      return ack(packageType, pkg.id, { error: FdcErrorCode.KeyNotFound });
    }

    const handler = this.handlerFor(packageType);
    if (!handler) {
      if (this.options.acknowledgeUnhandled === false) {
        return { status: 500, contentType: "text/plain", body: "No handler" };
      }
      return ack(packageType, pkg.id);
    }

    try {
      const result = (await handler(pkg as never, ctx)) ?? {};
      return ack(packageType, pkg.id, result);
    } catch {
      // Returning a non-200 lets Szamlazz.hu retry (within its 72h window).
      return { status: 500, contentType: "text/plain", body: "Handler error" };
    }
  }

  /** Fetch API adapter: turns a `Request` into a `Response`. */
  async webHandler(request: Request): Promise<Response> {
    const body = await request.text();
    const result = await this.handle({ body, headers: request.headers });
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": result.contentType },
    });
  }

  private handlerFor(type: FdcPackageType) {
    const h = this.options.handlers;
    switch (type) {
      case "outgoing-invoice":
        return h.onOutgoingInvoice?.bind(h);
      case "incoming-invoice":
        return h.onIncomingInvoice?.bind(h);
      case "bank-transaction":
        return h.onBankTransaction?.bind(h);
      case "receipt":
        return h.onReceipt?.bind(h);
    }
  }

  private async verify(key: string | undefined): Promise<boolean> {
    if (this.options.verifyKey) return this.options.verifyKey(key);
    if (this.options.key === undefined) return true;
    const expected = Array.isArray(this.options.key)
      ? this.options.key
      : [this.options.key];
    return key !== undefined && expected.includes(key);
  }
}

function ack(
  packageType: FdcPackageType,
  id: string,
  result: FdcAck = {},
): FdcHandleResult {
  return {
    status: 200,
    contentType: XML_CONTENT_TYPE,
    body: buildAck(packageType, id, result),
    packageType,
  };
}

function getHeader(
  headers: FdcHandleInput["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v ?? undefined;
    }
  }
  return undefined;
}
