import { postXml, DEFAULT_ENDPOINT } from "./core/transport.js";
import { SzamlazzError } from "./core/errors.js";
import {
  buildCreateInvoiceXml,
  parseCreateInvoiceResponse,
  type CreateInvoiceOptions,
  type CreateInvoiceResult,
} from "./operations/invoice.js";
import {
  buildReverseInvoiceXml,
  parseReverseInvoiceResponse,
  type ReverseInvoiceOptions,
  type ReverseInvoiceResult,
} from "./operations/storno.js";
import {
  buildRegisterPaymentXml,
  parseRegisterPaymentResponse,
  type RegisterPaymentOptions,
  type RegisterPaymentResult,
} from "./operations/payment.js";
import {
  buildGetPdfXml,
  parseGetPdfResponse,
  buildGetInvoiceXmlXml,
  parseGetInvoiceXmlResponse,
  type DocumentSelector,
  type InvoiceXmlResult,
} from "./operations/query.js";
import {
  buildDeleteProformaXml,
  parseDeleteProformaResponse,
  type DeleteProformaOptions,
  type DeleteProformaResult,
} from "./operations/proforma.js";
import {
  buildCreateReceiptXml,
  buildReverseReceiptXml,
  buildGetReceiptXml,
  buildSendReceiptXml,
  parseReceiptResponse,
  parseSendReceiptResponse,
  type CreateReceiptOptions,
  type ReceiptResult,
  type SendReceiptOptions,
  type SendReceiptResult,
} from "./operations/receipt.js";
import {
  buildQueryTaxpayerXml,
  parseQueryTaxpayerResponse,
  type TaxpayerResult,
} from "./operations/taxpayer.js";

export interface SzamlazzClientOptions {
  /** Szamla Agent key / token (`szamlaagentkulcs`). */
  agentKey: string;
  /** Override the API endpoint (defaults to the production URL). */
  endpoint?: string;
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Typed client for the Szamlazz.hu Szamla Agent API, authenticated with an
 * Agent key (token). One instance is reusable across requests.
 */
export class SzamlazzClient {
  private readonly agentKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly timeoutMs?: number;

  constructor(options: SzamlazzClientOptions) {
    if (!options.agentKey) {
      throw new SzamlazzError("`agentKey` is required.");
    }
    this.agentKey = options.agentKey;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetch;
    this.timeoutMs = options.timeoutMs;
  }

  private send(action: Parameters<typeof postXml>[0], xml: string) {
    return postXml(action, xml, {
      endpoint: this.endpoint,
      fetch: this.fetchImpl,
      timeoutMs: this.timeoutMs,
    });
  }

  /** Creates an invoice or proforma (`xmlszamla`). */
  async createInvoice(
    opts: CreateInvoiceOptions,
    requestPdf = false,
  ): Promise<CreateInvoiceResult> {
    const xml = buildCreateInvoiceXml(this.agentKey, opts, requestPdf);
    const res = await this.send("action-xmlagentxmlfile", xml);
    return parseCreateInvoiceResponse(res);
  }

  /** Cancels (reverses) an invoice with a storno invoice (`xmlszamlast`). */
  async reverseInvoice(
    opts: ReverseInvoiceOptions,
    requestPdf = false,
  ): Promise<ReverseInvoiceResult> {
    const xml = buildReverseInvoiceXml(this.agentKey, opts, requestPdf);
    const res = await this.send("action-szamla_agent_st", xml);
    return parseReverseInvoiceResponse(res);
  }

  /** Registers a payment / credit entry against an invoice (`xmlszamlakifiz`). */
  async registerPayment(
    opts: RegisterPaymentOptions,
  ): Promise<RegisterPaymentResult> {
    const xml = buildRegisterPaymentXml(this.agentKey, opts);
    const res = await this.send("action-szamla_agent_kifiz", xml);
    return parseRegisterPaymentResponse(res);
  }

  /** Downloads an existing invoice PDF (`xmlszamlapdf`). */
  async getInvoicePdf(selector: DocumentSelector): Promise<Uint8Array> {
    const xml = buildGetPdfXml(this.agentKey, selector);
    const res = await this.send("action-szamla_agent_pdf", xml);
    return parseGetPdfResponse(res);
  }

  /** Retrieves an existing invoice as parsed XML (`xmlszamlaxml`). */
  async getInvoiceXml(selector: DocumentSelector): Promise<InvoiceXmlResult> {
    const xml = buildGetInvoiceXmlXml(this.agentKey, selector);
    const res = await this.send("action-szamla_agent_xml", xml);
    return parseGetInvoiceXmlResponse(res);
  }

  /** Deletes a proforma / pro forma invoice (`xmlszamladbkdel`). */
  async deleteProforma(
    opts: DeleteProformaOptions,
  ): Promise<DeleteProformaResult> {
    const xml = buildDeleteProformaXml(this.agentKey, opts);
    const res = await this.send("action-szamla_agent_dijbekero_torlese", xml);
    return parseDeleteProformaResponse(res);
  }

  /** Creates a receipt (`xmlnyugtacreate`). */
  async createReceipt(
    opts: CreateReceiptOptions,
    requestPdf = false,
  ): Promise<ReceiptResult> {
    const xml = buildCreateReceiptXml(this.agentKey, opts, requestPdf);
    const res = await this.send("action-szamla_agent_nyugta_create", xml);
    return parseReceiptResponse(res);
  }

  /** Cancels (reverses) a receipt (`xmlnyugtast`). */
  async reverseReceipt(
    receiptNumber: string,
    requestPdf = false,
  ): Promise<ReceiptResult> {
    const xml = buildReverseReceiptXml(this.agentKey, receiptNumber, requestPdf);
    const res = await this.send("action-szamla_agent_nyugta_storno", xml);
    return parseReceiptResponse(res);
  }

  /** Queries an existing receipt (`xmlnyugtaget`). */
  async getReceipt(
    receiptNumber: string,
    requestPdf = false,
  ): Promise<ReceiptResult> {
    const xml = buildGetReceiptXml(this.agentKey, receiptNumber, requestPdf);
    const res = await this.send("action-szamla_agent_nyugta_get", xml);
    return parseReceiptResponse(res);
  }

  /** E-mails an existing receipt to a recipient (`xmlnyugtasend`). */
  async sendReceipt(opts: SendReceiptOptions): Promise<SendReceiptResult> {
    const xml = buildSendReceiptXml(this.agentKey, opts);
    const res = await this.send("action-szamla_agent_nyugta_send", xml);
    return parseSendReceiptResponse(res);
  }

  /** Looks up a Hungarian taxpayer by tax number via NAV (`xmltaxpayer`). */
  async queryTaxpayer(taxNumber: string): Promise<TaxpayerResult> {
    const xml = buildQueryTaxpayerXml(this.agentKey, taxNumber);
    const res = await this.send("action-szamla_agent_taxpayer", xml);
    return parseQueryTaxpayerResponse(res);
  }
}
