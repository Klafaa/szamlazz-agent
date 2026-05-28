import { describe, it, expect } from "vitest";
import { buildReverseInvoiceXml } from "./storno.js";
import { buildRegisterPaymentXml } from "./payment.js";
import { buildDeleteProformaXml } from "./proforma.js";
import { buildGetPdfXml, buildGetInvoiceXmlXml } from "./query.js";
import {
  buildCreateReceiptXml,
  buildSendReceiptXml,
} from "./receipt.js";
import { buildQueryTaxpayerXml, parseQueryTaxpayerResponse } from "./taxpayer.js";
import { assertSuccess } from "../core/response.js";

const KEY = "AGENT-KEY";

describe("storno builder", () => {
  const xml = buildReverseInvoiceXml(KEY, { invoiceNumber: "E-2026-1" }, false);
  it("targets xmlszamlast with the invoice number", () => {
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamlast"');
    expect(xml).toContain("<szamlaszam>E-2026-1</szamlaszam>");
    expect(xml).toContain("<szamlaLetoltes>false</szamlaLetoltes>");
  });
});

describe("payment builder", () => {
  const xml = buildRegisterPaymentXml(KEY, {
    invoiceNumber: "E-2026-1",
    additive: true,
    entries: [
      { date: "2026-06-01", title: "átutalás", amount: 12700, description: "n" },
    ],
  });
  it("renders settings and a kifizetes entry", () => {
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamlakifiz"');
    expect(xml).toContain("<additiv>true</additiv>");
    expect(xml).toContain(
      "<kifizetes><datum>2026-06-01</datum><jogcim>átutalás</jogcim>" +
        "<osszeg>12700</osszeg><leiras>n</leiras></kifizetes>",
    );
  });
});

describe("proforma delete builder", () => {
  it("builds by invoice number", () => {
    const xml = buildDeleteProformaXml(KEY, { proformaNumber: "D-2026-1" });
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamladbkdel"');
    expect(xml).toContain("<szamlaszam>D-2026-1</szamlaszam>");
  });
});

describe("query builders", () => {
  it("pdf query requests valaszVerzio 1", () => {
    const xml = buildGetPdfXml(KEY, { invoiceNumber: "E-2026-1" });
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamlapdf"');
    expect(xml).toContain("<valaszVerzio>1</valaszVerzio>");
  });
  it("xml query disables pdf", () => {
    const xml = buildGetInvoiceXmlXml(KEY, { orderNumber: "ORD-9" });
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamlaxml"');
    expect(xml).toContain("<rendelesSzam>ORD-9</rendelesSzam>");
    expect(xml).toContain("<pdf>false</pdf>");
  });
});

describe("receipt builders", () => {
  it("create receipt nests items and payments", () => {
    const xml = buildCreateReceiptXml(
      KEY,
      {
        prefix: "NYGTA",
        paymentMethod: "készpénz",
        currency: "HUF",
        items: [
          {
            name: "Termék",
            quantity: 1,
            unit: "db",
            netUnitPrice: 1000,
            netAmount: 1000,
            vatRate: 27,
            vatAmount: 270,
            grossAmount: 1270,
          },
        ],
        payments: [{ method: "készpénz", amount: 1270 }],
      },
      true,
    );
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlnyugtacreate"');
    expect(xml).toContain("<pdfLetoltes>true</pdfLetoltes>");
    expect(xml).toContain("<elotag>NYGTA</elotag>");
    expect(xml).toContain("<fizetoeszkoz>készpénz</fizetoeszkoz>");
    // XSD requires afakulcs before netto inside a receipt line item.
    expect(xml.indexOf("<afakulcs>")).toBeLessThan(xml.indexOf("<netto>"));
  });

  it("send receipt includes the recipient email", () => {
    const xml = buildSendReceiptXml(KEY, {
      receiptNumber: "NY-2026-1",
      email: "a@b.hu",
    });
    expect(xml).toContain("<nyugtaszam>NY-2026-1</nyugtaszam>");
    expect(xml).toContain("<email>a@b.hu</email>");
  });
});

describe("taxpayer", () => {
  it("builds the query", () => {
    const xml = buildQueryTaxpayerXml(KEY, "12345678");
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmltaxpayer"');
    expect(xml).toContain("<torzsszam>12345678</torzsszam>");
  });

  it("parses a valid taxpayer (NAV response with ns prefixes)", () => {
    const res = parseQueryTaxpayerResponse({
      body: new Uint8Array(),
      headers: {},
      text:
        `<?xml version="1.0"?><ns2:QueryTaxpayerResponse xmlns:ns2="x">` +
        `<result><funcCode>OK</funcCode></result>` +
        `<ns2:taxpayerValidity>true</ns2:taxpayerValidity>` +
        `<ns2:taxpayerData><ns2:taxpayerName>KBOSS.HU KFT.</ns2:taxpayerName></ns2:taxpayerData>` +
        `</ns2:QueryTaxpayerResponse>`,
    });
    expect(res.queryStatus).toBe("OK");
    expect(res.valid).toBe(true);
    expect(res.name).toBe("KBOSS.HU KFT.");
  });

  it("reports an invalid taxpayer", () => {
    const res = parseQueryTaxpayerResponse({
      body: new Uint8Array(),
      headers: {},
      text:
        `<?xml version="1.0"?><QueryTaxpayerResponse>` +
        `<result><funcCode>OK</funcCode></result>` +
        `<taxpayerValidity>false</taxpayerValidity></QueryTaxpayerResponse>`,
    });
    expect(res.valid).toBe(false);
  });
});

describe("assertSuccess", () => {
  it("does not throw when sikeres=true even with hibakod=0", () => {
    expect(() =>
      assertSuccess({ sikeres: "true", hibakod: "0" }, "<x/>"),
    ).not.toThrow();
  });

  it("throws when sikeres=false", () => {
    expect(() =>
      assertSuccess({ sikeres: "false", hibakod: "57", hibauzenet: "nope" }, "<x/>"),
    ).toThrow(/nope/);
  });
});
