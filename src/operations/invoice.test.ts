import { describe, it, expect } from "vitest";
import { buildCreateInvoiceXml } from "./invoice.js";

const opts = {
  header: {
    fulfillmentDate: "2026-05-28",
    paymentDeadline: "2026-06-11",
    paymentMethod: "átutalás",
    currency: "HUF",
    language: "hu",
  },
  seller: {
    bank: "Demo Bank",
    bankAccount: "12345678-12345678",
  },
  buyer: {
    name: "Teszt Kft. & Társa",
    zip: "1011",
    city: "Budapest",
    address: "Fő utca 1.",
    taxNumber: "12345678-2-41",
  },
  items: [
    {
      name: "Tanácsadás",
      quantity: 1,
      unit: "óra",
      netUnitPrice: 10000,
      vatRate: 27,
      netAmount: 10000,
      vatAmount: 2700,
      grossAmount: 12700,
    },
  ],
};

describe("buildCreateInvoiceXml", () => {
  const xml = buildCreateInvoiceXml("KEY-123", opts, true);

  it("includes the agent key and requested settings", () => {
    expect(xml).toContain("<szamlaagentkulcs>KEY-123</szamlaagentkulcs>");
    expect(xml).toContain("<szamlaLetoltes>true</szamlaLetoltes>");
    expect(xml).toContain("<valaszVerzio>2</valaszVerzio>");
  });

  it("escapes buyer data", () => {
    expect(xml).toContain("<nev>Teszt Kft. &amp; Társa</nev>");
  });

  it("keeps the XSD section order: beallitasok, fejlec, elado, vevo, tetelek", () => {
    const order = ["beallitasok", "fejlec", "elado", "vevo", "tetelek"].map(
      (tag) => xml.indexOf(`<${tag}`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it("always emits the required <elado>, even without seller data", () => {
    const noSeller = { ...opts, seller: undefined };
    const xml2 = buildCreateInvoiceXml("KEY", noSeller, false);
    expect(xml2).toContain("<elado></elado>");
  });

  it("renders line items in field order", () => {
    expect(xml).toContain(
      "<tetel><megnevezes>Tanácsadás</megnevezes><mennyiseg>1</mennyiseg>" +
        "<mennyisegiEgyseg>óra</mennyisegiEgyseg><nettoEgysegar>10000</nettoEgysegar>" +
        "<afakulcs>27</afakulcs><nettoErtek>10000</nettoErtek>" +
        "<afaErtek>2700</afaErtek><bruttoErtek>12700</bruttoErtek></tetel>",
    );
  });
});
