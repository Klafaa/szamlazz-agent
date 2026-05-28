import { describe, it, expect } from "vitest";
import type { RawResponse } from "../core/transport.js";
import { parseCreateInvoiceResponse } from "./invoice.js";
import { parseReverseInvoiceResponse } from "./storno.js";
import { parseRegisterPaymentResponse } from "./payment.js";
import { parseDeleteProformaResponse } from "./proforma.js";
import { parseGetPdfResponse, parseGetInvoiceXmlResponse } from "./query.js";
import { parseReceiptResponse, parseSendReceiptResponse } from "./receipt.js";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const PDF_BASE64 = "JVBERi0x"; // base64 of "%PDF-1"

function xmlRes(text: string): RawResponse {
  return { body: new Uint8Array(), headers: {}, text };
}
function pdfRes(): RawResponse {
  return { body: PDF_BYTES, headers: {}, text: "%PDF-1" };
}
function headerRes(headers: Record<string, string>): RawResponse {
  return { body: PDF_BYTES, headers, text: "" };
}

describe("parseCreateInvoiceResponse", () => {
  it("reads fields and decodes the embedded PDF (valaszVerzio=2)", () => {
    const r = parseCreateInvoiceResponse(
      xmlRes(
        `<xmlszamlavalasz><sikeres>true</sikeres><szamlaszam>E-2026-1</szamlaszam>` +
          `<szamlanetto>10000</szamlanetto><szamlabrutto>12700</szamlabrutto>` +
          `<kintlevoseg>0</kintlevoseg><vevoifiokurl>https://x</vevoifiokurl>` +
          `<pdf>${PDF_BASE64}</pdf></xmlszamlavalasz>`,
      ),
    );
    expect(r.success).toBe(true);
    expect(r.invoiceNumber).toBe("E-2026-1");
    expect(r.netTotal).toBe("10000");
    expect(r.grossTotal).toBe("12700");
    expect(r.buyerAccountUrl).toBe("https://x");
    expect(Array.from(r.pdf!.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("falls back to headers and raw PDF body (valaszVerzio=1)", () => {
    const r = parseCreateInvoiceResponse(
      headerRes({ szlahu_szamlaszam: "E-2026-2", szlahu_szamlabrutto: "999" }),
    );
    expect(r.invoiceNumber).toBe("E-2026-2");
    expect(r.grossTotal).toBe("999");
    expect(r.pdf).toBe(PDF_BYTES);
  });

  it("throws on an unsuccessful response", () => {
    expect(() =>
      parseCreateInvoiceResponse(
        xmlRes(
          `<xmlszamlavalasz><sikeres>false</sikeres><hibakod>57</hibakod>` +
            `<hibauzenet>nope</hibauzenet></xmlszamlavalasz>`,
        ),
      ),
    ).toThrow(/nope/);
  });
});

describe("parseReverseInvoiceResponse", () => {
  it("reads the storno invoice number", () => {
    const r = parseReverseInvoiceResponse(
      xmlRes(`<xmlszamlavalasz><sikeres>true</sikeres><szamlaszam>ST-1</szamlaszam></xmlszamlavalasz>`),
    );
    expect(r.success).toBe(true);
    expect(r.invoiceNumber).toBe("ST-1");
  });
});

describe("parseRegisterPaymentResponse", () => {
  it("reports success", () => {
    const r = parseRegisterPaymentResponse(
      xmlRes(`<xmlszamlakifizvalasz><sikeres>true</sikeres></xmlszamlakifizvalasz>`),
    );
    expect(r.success).toBe(true);
  });
  it("throws on failure", () => {
    expect(() =>
      parseRegisterPaymentResponse(
        xmlRes(`<xmlszamlakifizvalasz><sikeres>false</sikeres><hibauzenet>err</hibauzenet></xmlszamlakifizvalasz>`),
      ),
    ).toThrow(/err/);
  });
});

describe("parseDeleteProformaResponse", () => {
  it("reports success", () => {
    const r = parseDeleteProformaResponse(
      xmlRes(`<xmlszamladbkdelvalasz><sikeres>true</sikeres></xmlszamladbkdelvalasz>`),
    );
    expect(r.success).toBe(true);
  });
});

describe("parseGetPdfResponse", () => {
  it("returns raw PDF bytes", () => {
    expect(parseGetPdfResponse(pdfRes())).toBe(PDF_BYTES);
  });
  it("decodes a base64 PDF envelope", () => {
    const out = parseGetPdfResponse(
      xmlRes(`<xmlszamlavalasz><pdf>${PDF_BASE64}</pdf></xmlszamlavalasz>`),
    );
    expect(Array.from(out.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
  it("throws when no PDF is present", () => {
    expect(() => parseGetPdfResponse(xmlRes(`<xmlszamlavalasz/>`))).toThrow(/did not contain a PDF/);
  });
});

describe("parseGetInvoiceXmlResponse", () => {
  it("returns parsed object and raw XML", () => {
    const text = `<szamla><alap><szamlaszam>E-1</szamlaszam></alap></szamla>`;
    const r = parseGetInvoiceXmlResponse(xmlRes(text));
    expect(r.raw).toBe(text);
    expect((r.invoice as any).szamla.alap.szamlaszam).toBe("E-1");
  });
});

describe("parseReceiptResponse", () => {
  it("reads the receipt number and decodes the PDF", () => {
    const r = parseReceiptResponse(
      xmlRes(
        `<xmlnyugtavalasz><sikeres>true</sikeres><nyugta><alap>` +
          `<nyugtaszam>NY-2026-1</nyugtaszam></alap></nyugta>` +
          `<nyugtaPdf>${PDF_BASE64}</nyugtaPdf></xmlnyugtavalasz>`,
      ),
    );
    expect(r.success).toBe(true);
    expect(r.receiptNumber).toBe("NY-2026-1");
    expect(Array.from(r.pdf!.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});

describe("parseSendReceiptResponse", () => {
  it("reports success", () => {
    const r = parseSendReceiptResponse(
      xmlRes(`<xmlnyugtavalasz><sikeres>true</sikeres></xmlnyugtavalasz>`),
    );
    expect(r.success).toBe(true);
  });
});
