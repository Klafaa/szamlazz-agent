import { document, elem, leaf } from "../core/xml.js";
import { parseXml, assertSuccess, decodeBase64, header } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

/** A single invoice line item (`tetel`). */
export interface InvoiceItem {
  /** Item name / description (`megnevezes`). */
  name: string;
  /** Optional item identifier (`azonosito`). */
  id?: string;
  /** Quantity (`mennyiseg`). */
  quantity: number;
  /** Unit of measure, e.g. "db", "óra" (`mennyisegiEgyseg`). */
  unit: string;
  /** Net unit price (`nettoEgysegar`). */
  netUnitPrice: number;
  /** VAT rate, e.g. 27, "AAM", "TAM" (`afakulcs`). */
  vatRate: number | string;
  /** Net total for the line (`nettoErtek`). */
  netAmount: number;
  /** VAT amount for the line (`afaErtek`). */
  vatAmount: number;
  /** Gross total for the line (`bruttoErtek`). */
  grossAmount: number;
  /** Per-item comment (`megjegyzes`). */
  comment?: string;
}

/** The selling party (`elado`). All fields optional — taken from account by default. */
export interface Seller {
  bank?: string;
  bankAccount?: string;
  emailReplyTo?: string;
  emailSubject?: string;
  emailText?: string;
  signerName?: string;
}

/** The buyer (`vevo`). */
export interface Buyer {
  name: string;
  country?: string;
  zip: string;
  city: string;
  address: string;
  email?: string;
  /** Send the invoice to the buyer by e-mail (`sendEmail`). */
  sendEmail?: boolean;
  /** Whether the buyer is a taxable entity (`adoalany`): 7,1,0,-1. */
  taxSubject?: number;
  taxNumber?: string;
  euTaxNumber?: string;
  postalName?: string;
  postalCountry?: string;
  postalZip?: string;
  postalCity?: string;
  postalAddress?: string;
  /** Buyer ledger / partner identifier (`azonosito`). */
  identifier?: string;
  phone?: string;
  comment?: string;
}

/** Invoice header (`fejlec`). */
export interface InvoiceHeader {
  /** Issue date, `YYYY-MM-DD` (`keltDatum`). Defaults to today server-side. */
  issueDate?: string;
  /** Fulfillment date, `YYYY-MM-DD` (`teljesitesDatum`). */
  fulfillmentDate?: string;
  /** Payment deadline, `YYYY-MM-DD` (`fizetesiHataridoDatum`). */
  paymentDeadline?: string;
  /** Payment method (`fizmod`). */
  paymentMethod: string;
  /** Currency (`penznem`). */
  currency: string;
  /** Invoice language (`szamlaNyelve`). */
  language: string;
  /** Free-text comment (`megjegyzes`). */
  comment?: string;
  /** Exchange-rate bank label (`arfolyamBank`). */
  exchangeRateBank?: string;
  /** Exchange rate (`arfolyam`). */
  exchangeRate?: number;
  /** Order number (`rendelesSzam`). */
  orderNumber?: string;
  /** Reference proforma number (`dijbekeroSzamlaszam`). */
  proformaNumber?: string;
  /** Is a deposit invoice (`elolegszamla`). */
  depositInvoice?: boolean;
  /** Is a final invoice (`vegszamla`). */
  finalInvoice?: boolean;
  /** Is a corrective invoice (`helyesbitoszamla`). */
  correctiveInvoice?: boolean;
  /** Corrected invoice number (`helyesbitettSzamlaszam`). */
  correctedInvoiceNumber?: string;
  /** Issue a proforma instead of an invoice (`dijbekero`). */
  proforma?: boolean;
  /** Invoice number prefix (`szamlaszamElotag`). */
  invoicePrefix?: string;
  /** Mark as already paid (`fizetve`). */
  paid?: boolean;
}

export interface CreateInvoiceOptions {
  /** Create an e-invoice (`eszamla`). */
  eInvoice?: boolean;
  /** Number of PDF copies to return (`szamlaLetoltesPld`). */
  pdfCopies?: number;
  /** External invoice id for idempotency (`szamlaKulsoAzon`). */
  externalId?: string;
  header: InvoiceHeader;
  seller?: Seller;
  buyer: Buyer;
  items: InvoiceItem[];
}

export interface CreateInvoiceResult {
  success: boolean;
  /** Generated invoice number (`szamlaszam`). */
  invoiceNumber?: string;
  netTotal?: string;
  grossTotal?: string;
  /** Outstanding balance (`kintlevoseg`). */
  outstanding?: string;
  /** Buyer account URL (`vevoifiokurl`). */
  buyerAccountUrl?: string;
  /** Generated PDF bytes, when `requestPdf` was true. */
  pdf?: Uint8Array;
}

const NS = "http://www.szamlazz.hu/xmlszamla";

export function buildCreateInvoiceXml(
  agentKey: string,
  opts: CreateInvoiceOptions,
  requestPdf: boolean,
): string {
  const h = opts.header;
  const b = opts.buyer;
  const s = opts.seller ?? {};

  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("eszamla", opts.eInvoice ?? false),
    leaf("szamlaLetoltes", requestPdf),
    leaf("szamlaLetoltesPld", opts.pdfCopies),
    leaf("valaszVerzio", 2),
    leaf("szamlaKulsoAzon", opts.externalId),
  ]);

  const fejlec = elem("fejlec", [
    leaf("keltDatum", h.issueDate),
    leaf("teljesitesDatum", h.fulfillmentDate),
    leaf("fizetesiHataridoDatum", h.paymentDeadline),
    leaf("fizmod", h.paymentMethod),
    leaf("penznem", h.currency),
    leaf("szamlaNyelve", h.language),
    leaf("megjegyzes", h.comment),
    leaf("arfolyamBank", h.exchangeRateBank),
    leaf("arfolyam", h.exchangeRate),
    leaf("rendelesSzam", h.orderNumber),
    leaf("dijbekeroSzamlaszam", h.proformaNumber),
    leaf("elolegszamla", h.depositInvoice),
    leaf("vegszamla", h.finalInvoice),
    leaf("helyesbitoszamla", h.correctiveInvoice),
    leaf("helyesbitettSzamlaszam", h.correctedInvoiceNumber),
    leaf("dijbekero", h.proforma),
    leaf("szamlaszamElotag", h.invoicePrefix),
    leaf("fizetve", h.paid),
  ]);

  // <elado> is required by the schema even when empty (seller data is taken
  // from the account), so always emit it.
  const elado = elem(
    "elado",
    [
      leaf("bank", s.bank),
      leaf("bankszamlaszam", s.bankAccount),
      leaf("emailReplyto", s.emailReplyTo),
      leaf("emailTargy", s.emailSubject),
      leaf("emailSzoveg", s.emailText),
      leaf("alairoNeve", s.signerName),
    ],
    { keepEmpty: true },
  );

  const vevo = elem("vevo", [
    leaf("nev", b.name),
    leaf("orszag", b.country),
    leaf("irsz", b.zip),
    leaf("telepules", b.city),
    leaf("cim", b.address),
    leaf("email", b.email),
    leaf("sendEmail", b.sendEmail),
    leaf("adoalany", b.taxSubject),
    leaf("adoszam", b.taxNumber),
    leaf("adoszamEU", b.euTaxNumber),
    leaf("postazasiNev", b.postalName),
    leaf("postazasiOrszag", b.postalCountry),
    leaf("postazasiIrsz", b.postalZip),
    leaf("postazasiTelepules", b.postalCity),
    leaf("postazasiCim", b.postalAddress),
    leaf("azonosito", b.identifier),
    leaf("telefonszam", b.phone),
    leaf("megjegyzes", b.comment),
  ]);

  const tetelek = elem(
    "tetelek",
    opts.items.map((item) =>
      elem("tetel", [
        leaf("megnevezes", item.name),
        leaf("azonosito", item.id),
        leaf("mennyiseg", item.quantity),
        leaf("mennyisegiEgyseg", item.unit),
        leaf("nettoEgysegar", item.netUnitPrice),
        leaf("afakulcs", item.vatRate),
        leaf("nettoErtek", item.netAmount),
        leaf("afaErtek", item.vatAmount),
        leaf("bruttoErtek", item.grossAmount),
        leaf("megjegyzes", item.comment),
      ]),
    ),
    { keepEmpty: true },
  );

  return document("xmlszamla", NS, [beallitasok, fejlec, elado, vevo, tetelek]);
}

export function parseCreateInvoiceResponse(res: RawResponse): CreateInvoiceResult {
  // valaszVerzio=2 returns an XML envelope; older/raw responses fall back to headers.
  const parsed = parseXml<{ xmlszamlavalasz?: Record<string, unknown> }>(res.text);
  const v = parsed.xmlszamlavalasz;
  assertSuccess(v, res.text);

  const pdfBase64 = v?.["pdf"];
  return {
    success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true,
    invoiceNumber: (v?.["szamlaszam"] as string) ?? header(res, "szamlaszam"),
    netTotal: (v?.["szamlanetto"] as string) ?? header(res, "szamlanetto"),
    grossTotal: (v?.["szamlabrutto"] as string) ?? header(res, "szamlabrutto"),
    outstanding: (v?.["kintlevoseg"] as string) ?? header(res, "kintlevoseg"),
    buyerAccountUrl:
      (v?.["vevoifiokurl"] as string) ?? header(res, "vevoifiokurl"),
    pdf:
      typeof pdfBase64 === "string"
        ? decodeBase64(pdfBase64)
        : looksLikePdf(res.body)
          ? res.body
          : undefined,
  };
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ); // "%PDF"
}
