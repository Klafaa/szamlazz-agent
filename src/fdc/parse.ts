import { parseXml } from "../core/response.js";
import { SzamlazzError } from "../core/errors.js";
import type {
  FdcItem,
  FdcPackage,
  FdcPackageType,
  OutgoingInvoice,
  IncomingInvoice,
  BankTransaction,
  Receipt,
} from "./types.js";

function rootName(parsed: Record<string, unknown>): string | undefined {
  return Object.keys(parsed).find((k) => k !== "?xml");
}

/** Coerces a value that may be a single object or an array into an array. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** Maps an incoming root element to a package type, when recognised. */
export function detectPackageType(rawBody: string): FdcPackageType | undefined {
  const parsed = parseXml<Record<string, unknown>>(rawBody);
  switch (rootName(parsed)) {
    case "szamla":
      return "outgoing-invoice";
    case "szamlabe":
      return "incoming-invoice";
    case "banktranz":
      return "bank-transaction";
    case "xmlnyugtaarchiv":
    case "nyugta":
      return "receipt";
    default:
      return undefined;
  }
}

/** Parses an incoming Financial Data Connection package into a typed object. */
export function parsePackage(rawBody: string): FdcPackage {
  const parsed = parseXml<Record<string, any>>(rawBody);
  const root = rootName(parsed);

  switch (root) {
    case "szamla":
      return parseOutgoingInvoice(parsed["szamla"]);
    case "szamlabe":
      return parseIncomingInvoice(parsed["szamlabe"]);
    case "banktranz":
      return parseBankTransaction(parsed["banktranz"]);
    case "xmlnyugtaarchiv":
      return parseReceipt(toArray(parsed["xmlnyugtaarchiv"]?.["nyugta"])[0]);
    case "nyugta":
      return parseReceipt(parsed["nyugta"]);
    default:
      throw new SzamlazzError(
        `Unrecognised Financial Data Connection package root: <${root ?? "?"}>`,
        { responseBody: rawBody },
      );
  }
}

function itemsFrom(container: any, key = "tetel"): FdcItem[] {
  return toArray<FdcItem>(container?.[key]);
}

function parseOutgoingInvoice(node: any): OutgoingInvoice {
  const base = node?.["alap"] ?? {};
  return {
    type: "outgoing-invoice",
    id: asString(base["id"]) ?? "",
    seller: node?.["szallito"],
    base,
    buyer: node?.["vevo"],
    items: itemsFrom(node?.["tetelek"]),
    totals: node?.["osszegek"],
    payments: toArray(node?.["kifizetesek"]?.["kifizetes"]),
    pdfBase64: asString(node?.["pdf"]),
    raw: node ?? {},
  };
}

function parseIncomingInvoice(node: any): IncomingInvoice {
  const base = node?.["alap"] ?? {};
  return {
    type: "incoming-invoice",
    id: asString(base["id"]) ?? asString(node?.["id"]) ?? "",
    base,
    raw: node ?? {},
  };
}

function parseBankTransaction(node: any): BankTransaction {
  const partner = node?.["partner"];
  return {
    type: "bank-transaction",
    id: asString(node?.["id"]) ?? "",
    account: asString(node?.["bankszamla"]),
    valueDate: asString(node?.["erteknap"]),
    direction: node?.["irany"] as "BE" | "KI" | undefined,
    transactionType: asString(node?.["tipus"]),
    technical: node?.["technikai"] === "true" || node?.["technikai"] === true,
    amount: node?.["osszeg"] !== undefined ? Number(node["osszeg"]) : undefined,
    currency: asString(node?.["devizanem"]),
    partner: partner
      ? { nev: asString(partner["nev"]), bankszamla: asString(partner["bankszamla"]) }
      : undefined,
    memo: asString(node?.["kozlemeny"]),
    raw: node ?? {},
  };
}

function parseReceipt(node: any): Receipt {
  const base = node?.["alap"] ?? {};
  return {
    type: "receipt",
    id: asString(base["id"]) ?? "",
    base,
    items: itemsFrom(node?.["tetelek"]),
    payments: toArray(node?.["kifizetesek"]?.["kifizetes"]),
    totals: node?.["osszegek"],
    raw: node ?? {},
  };
}
