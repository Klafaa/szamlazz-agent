/**
 * Types for the Szamlazz.hu "Penzugyi adatkapcsolat" (Financial Data
 * Connection) 5.0 PUSH interface. Szamlazz.hu POSTs an `application/xml`
 * package to a registered URL; the receiver parses it and replies with a
 * type-specific acknowledgment XML and HTTP 200.
 *
 * @see https://docs.szamlazz.hu/hu/penzugyi-adatkapcsolat
 */

/** The four kinds of data packages Szamlazz.hu can push. */
export type FdcPackageType =
  | "outgoing-invoice"
  | "incoming-invoice"
  | "bank-transaction"
  | "receipt";

/** Acknowledgment error codes the receiver may return (`hibakod`). */
export enum FdcErrorCode {
  /** Identification key not found — Szamlazz.hu stops resubmitting. */
  KeyNotFound = "KEY_ERR",
  /** Ask Szamlazz.hu to delete the connection; the account holder is notified. */
  DeleteKey = "KEY_DEL",
}

/** A parsed line item (`tetel`). Raw values are kept as strings. */
export interface FdcItem {
  nev?: string;
  megnevezes?: string;
  azonosito?: string;
  mennyiseg?: string;
  mennyisegiEgyseg?: string;
  nettoegysegar?: string;
  nettoEgysegar?: string;
  netto?: string;
  afatipus?: string;
  afakulcs?: string;
  afa?: string;
  brutto?: string;
  fokonyv?: Record<string, unknown>;
  megjegyzes?: string;
  [key: string]: unknown;
}

/** Outgoing invoice package (root `<szamla>`). */
export interface OutgoingInvoice {
  type: "outgoing-invoice";
  /** Invoice id — must be echoed back in the acknowledgment. */
  id: string;
  /** Seller / supplier (`szallito`). */
  seller?: Record<string, unknown>;
  /** Invoice header (`alap`): szamlaszam, tipus, kelt, telj, fizh, devizanem… */
  base: Record<string, unknown>;
  /** Buyer (`vevo`). */
  buyer?: Record<string, unknown>;
  items: FdcItem[];
  /** Totals (`osszegek`). */
  totals?: Record<string, unknown>;
  /** Payments (`kifizetesek`). */
  payments?: Record<string, unknown>[];
  /** Base64-encoded PDF, when included. */
  pdfBase64?: string;
  /** The full parsed XML object, so no data is lost. */
  raw: Record<string, unknown>;
}

/** Incoming invoice package (root `<szamlabe>`). */
export interface IncomingInvoice {
  type: "incoming-invoice";
  id: string;
  base: Record<string, unknown>;
  raw: Record<string, unknown>;
}

/** Bank transaction package (root `<banktranz>`). */
export interface BankTransaction {
  type: "bank-transaction";
  id: string;
  /** Bank account number (`bankszamla`). */
  account?: string;
  /** Value date (`erteknap`). */
  valueDate?: string;
  /** Direction (`irany`): "BE" (in) or "KI" (out). */
  direction?: "BE" | "KI";
  /** Transaction type (`tipus`). */
  transactionType?: string;
  /** Technical transaction flag (`technikai`). */
  technical?: boolean;
  /** Amount (`osszeg`). */
  amount?: number;
  /** Currency (`devizanem`). */
  currency?: string;
  /** Partner (`partner`): { nev, bankszamla }. */
  partner?: { nev?: string; bankszamla?: string };
  /** Memo / message (`kozlemeny`). */
  memo?: string;
  raw: Record<string, unknown>;
}

/** Receipt package (root `<xmlnyugtaarchiv>` wrapping `<nyugta>`). */
export interface Receipt {
  type: "receipt";
  id: string;
  /** Receipt header (`alap`): nyugtaszam, tipus, kelt, fizmod, penznem… */
  base: Record<string, unknown>;
  items: FdcItem[];
  payments?: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export type FdcPackage =
  | OutgoingInvoice
  | IncomingInvoice
  | BankTransaction
  | Receipt;

/**
 * Acknowledgment a handler returns. For invoices, `iktatoszam` is the
 * registration / booking number the receiver assigns (optional but
 * recommended). Returning an `error` makes the receiver reply with `hibakod`.
 */
export interface FdcAck {
  /** Registration / booking number (`iktatoszam`), invoices only. */
  iktatoszam?: string;
  /** Set to reply with a `hibakod` instead of a normal acknowledgment. */
  error?: FdcErrorCode;
}

/** Context passed to every handler. */
export interface FdcContext {
  /** The `X-Szamlazzhu-Key` value from the request. */
  key?: string;
  /** Detected package type. */
  packageType: FdcPackageType;
  /** Raw request body. */
  rawBody: string;
}
