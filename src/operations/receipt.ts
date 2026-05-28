import { document, elem, leaf } from "../core/xml.js";
import { parseXml, assertSuccess, decodeBase64 } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

/** A receipt line item (`tetel`). */
export interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  /** Net unit price (`nettoEgysegar`). */
  netUnitPrice: number;
  netAmount: number;
  /** VAT rate, e.g. 27, "AAM" (`afakulcs`). */
  vatRate: number | string;
  vatAmount: number;
  grossAmount: number;
}

/** A receipt payment row (`kifizetes`). */
export interface ReceiptPayment {
  /** Payment instrument (`fizetoeszkoz`). */
  method: string;
  amount: number;
  description?: string;
}

export interface CreateReceiptOptions {
  /**
   * Receipt number prefix (`elotag`). Required by the API — must be a receipt
   * block prefix configured in the Szamlazz.hu account.
   */
  prefix: string;
  /** Payment method (`fizmod`). */
  paymentMethod: string;
  /** Currency (`penznem`). */
  currency: string;
  /** Exchange rate (`devizaarf`). */
  exchangeRate?: number;
  /** Exchange-rate bank (`devizabank`). */
  exchangeRateBank?: string;
  comment?: string;
  /** Idempotency / call identifier (`hivasAzonosito`). */
  callId?: string;
  items: ReceiptItem[];
  payments?: ReceiptPayment[];
}

export interface ReceiptResult {
  success: boolean;
  /** Receipt number (`nyugtaszam`). */
  receiptNumber?: string;
  pdf?: Uint8Array;
  /** Full parsed `nyugta` block, when present. */
  receipt?: Record<string, unknown>;
}

const CREATE_NS = "http://www.szamlazz.hu/xmlnyugtacreate";
const STORNO_NS = "http://www.szamlazz.hu/xmlnyugtast";
const GET_NS = "http://www.szamlazz.hu/xmlnyugtaget";
const SEND_NS = "http://www.szamlazz.hu/xmlnyugtasend";

export function buildCreateReceiptXml(
  agentKey: string,
  opts: CreateReceiptOptions,
  requestPdf: boolean,
): string {
  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("pdfLetoltes", requestPdf),
  ]);

  const fejlec = elem("fejlec", [
    leaf("hivasAzonosito", opts.callId),
    leaf("elotag", opts.prefix),
    leaf("fizmod", opts.paymentMethod),
    leaf("penznem", opts.currency),
    leaf("devizaarf", opts.exchangeRate),
    leaf("devizabank", opts.exchangeRateBank),
    leaf("megjegyzes", opts.comment),
  ]);

  const tetelek = elem(
    "tetelek",
    opts.items.map((i) =>
      elem("tetel", [
        leaf("megnevezes", i.name),
        leaf("mennyiseg", i.quantity),
        leaf("mennyisegiEgyseg", i.unit),
        leaf("nettoEgysegar", i.netUnitPrice),
        leaf("afakulcs", i.vatRate),
        leaf("netto", i.netAmount),
        leaf("afa", i.vatAmount),
        leaf("brutto", i.grossAmount),
      ]),
    ),
    { keepEmpty: true },
  );

  const children = [beallitasok, fejlec, tetelek];
  if (opts.payments && opts.payments.length > 0) {
    children.push(
      elem(
        "kifizetesek",
        opts.payments.map((p) =>
          elem("kifizetes", [
            leaf("fizetoeszkoz", p.method),
            leaf("osszeg", p.amount),
            leaf("leiras", p.description),
          ]),
        ),
        { keepEmpty: true },
      ),
    );
  }

  return document("xmlnyugtacreate", CREATE_NS, children);
}

export function buildReverseReceiptXml(
  agentKey: string,
  receiptNumber: string,
  requestPdf: boolean,
): string {
  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("pdfLetoltes", requestPdf),
  ]);
  const fejlec = elem("fejlec", [leaf("nyugtaszam", receiptNumber)]);
  return document("xmlnyugtast", STORNO_NS, [beallitasok, fejlec]);
}

export function buildGetReceiptXml(
  agentKey: string,
  receiptNumber: string,
  requestPdf: boolean,
): string {
  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("pdfLetoltes", requestPdf),
  ]);
  const fejlec = elem("fejlec", [leaf("nyugtaszam", receiptNumber)]);
  return document("xmlnyugtaget", GET_NS, [beallitasok, fejlec]);
}

export interface SendReceiptOptions {
  receiptNumber: string;
  email: string;
}

export function buildSendReceiptXml(
  agentKey: string,
  opts: SendReceiptOptions,
): string {
  const beallitasok = elem("beallitasok", [leaf("szamlaagentkulcs", agentKey)]);
  const fejlec = elem("fejlec", [leaf("nyugtaszam", opts.receiptNumber)]);
  const emailKuldes = elem("emailKuldes", [leaf("email", opts.email)]);
  return document("xmlnyugtasend", SEND_NS, [beallitasok, fejlec, emailKuldes]);
}

export function parseReceiptResponse(res: RawResponse): ReceiptResult {
  const parsed = parseXml<{ xmlnyugtavalasz?: Record<string, unknown> }>(res.text);
  const v = parsed.xmlnyugtavalasz;
  assertSuccess(v, res.text);

  const nyugta = v?.["nyugta"] as Record<string, unknown> | undefined;
  const alap = nyugta?.["alap"] as Record<string, unknown> | undefined;
  const pdfBase64 = v?.["nyugtaPdf"] ?? v?.["pdfNyugta"] ?? v?.["pdf"];

  return {
    success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true,
    receiptNumber: alap?.["nyugtaszam"] as string | undefined,
    receipt: nyugta,
    pdf: typeof pdfBase64 === "string" ? decodeBase64(pdfBase64) : undefined,
  };
}

export interface ReverseReceiptResult extends ReceiptResult {}
export interface GetReceiptResult extends ReceiptResult {}
export interface SendReceiptResult {
  success: boolean;
}

export function parseSendReceiptResponse(res: RawResponse): SendReceiptResult {
  const parsed = parseXml<{ xmlnyugtavalasz?: Record<string, unknown> }>(res.text);
  const v = parsed.xmlnyugtavalasz;
  assertSuccess(v, res.text);
  return { success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true };
}
