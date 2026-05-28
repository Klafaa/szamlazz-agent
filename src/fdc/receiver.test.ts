import { describe, it, expect, vi } from "vitest";
import { FinancialDataReceiver } from "./receiver.js";
import { detectPackageType, parsePackage } from "./parse.js";
import { buildAck } from "./response.js";
import { FdcErrorCode } from "./types.js";

const outgoingInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<szamla xmlns="http://www.szamlazz.hu/szamla">
  <szallito><nev>Elado Kft.</nev></szallito>
  <alap><id>1001</id><szamlaszam>E-2026-1</szamlaszam><devizanem>HUF</devizanem></alap>
  <vevo><nev>Vevo Kft.</nev><adoszam>12345678-2-41</adoszam></vevo>
  <tetelek>
    <tetel><nev>Termek A</nev><mennyiseg>2</mennyiseg><brutto>2540</brutto></tetel>
    <tetel><nev>Termek B</nev><mennyiseg>1</mennyiseg><brutto>1270</brutto></tetel>
  </tetelek>
  <osszegek><totalossz><brutto>3810</brutto></totalossz></osszegek>
</szamla>`;

const bankTranzXml = `<?xml version="1.0" encoding="UTF-8"?>
<banktranz xmlns="http://www.szamlazz.hu/banktranz">
  <id>55</id><bankszamla>11111111-22222222</bankszamla>
  <erteknap>2026-05-28</erteknap><irany>BE</irany><technikai>false</technikai>
  <osszeg>3810</osszeg><devizanem>HUF</devizanem>
  <partner><nev>Vevo Kft.</nev><bankszamla>33333333-44444444</bankszamla></partner>
  <kozlemeny>E-2026-1</kozlemeny>
</banktranz>`;

describe("detectPackageType / parsePackage", () => {
  it("detects an outgoing invoice and extracts fields", () => {
    expect(detectPackageType(outgoingInvoiceXml)).toBe("outgoing-invoice");
    const pkg = parsePackage(outgoingInvoiceXml);
    expect(pkg.type).toBe("outgoing-invoice");
    expect(pkg.id).toBe("1001");
    if (pkg.type === "outgoing-invoice") {
      expect(pkg.items).toHaveLength(2);
      expect(pkg.base["szamlaszam"]).toBe("E-2026-1");
    }
  });

  it("detects and parses a bank transaction", () => {
    expect(detectPackageType(bankTranzXml)).toBe("bank-transaction");
    const pkg = parsePackage(bankTranzXml);
    if (pkg.type === "bank-transaction") {
      expect(pkg.id).toBe("55");
      expect(pkg.direction).toBe("BE");
      expect(pkg.amount).toBe(3810);
      expect(pkg.partner?.nev).toBe("Vevo Kft.");
    }
  });
});

describe("buildAck", () => {
  it("echoes the id and iktatoszam for invoices", () => {
    const xml = buildAck("outgoing-invoice", "1001", { iktatoszam: "IKT-1" });
    expect(xml).toContain('<szamlavalasz xmlns="http://www.szamlazz.hu/szamlavalasz">');
    expect(xml).toContain("<alap><id>1001</id><iktatoszam>IKT-1</iktatoszam></alap>");
  });

  it("emits only hibakod on error", () => {
    const xml = buildAck("outgoing-invoice", "1001", {
      error: FdcErrorCode.KeyNotFound,
    });
    expect(xml).toContain("<hibakod>KEY_ERR</hibakod>");
    expect(xml).not.toContain("<alap>");
  });

  it("emits an empty envelope for bank transactions", () => {
    const xml = buildAck("bank-transaction", "55");
    expect(xml).toContain('<banktranzvalasz xmlns="http://www.szamlazz.hu/banktranzvalasz">');
    expect(xml).not.toContain("<alap>");
  });
});

describe("FinancialDataReceiver", () => {
  it("dispatches to the handler and returns the acknowledgment", async () => {
    const onOutgoingInvoice = vi.fn(() => ({ iktatoszam: "IKT-9" }));
    const receiver = new FinancialDataReceiver({
      key: "ABC12",
      handlers: { onOutgoingInvoice },
    });

    const res = await receiver.handle({
      body: outgoingInvoiceXml,
      headers: { "X-Szamlazzhu-Key": "ABC12" },
    });

    expect(onOutgoingInvoice).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("application/xml");
    expect(res.body).toContain("<id>1001</id>");
    expect(res.body).toContain("<iktatoszam>IKT-9</iktatoszam>");
  });

  it("returns KEY_ERR when the key does not match", async () => {
    const onOutgoingInvoice = vi.fn();
    const receiver = new FinancialDataReceiver({
      key: "ABC12",
      handlers: { onOutgoingInvoice },
    });

    const res = await receiver.handle({
      body: outgoingInvoiceXml,
      headers: { "X-Szamlazzhu-Key": "WRONG" },
    });

    expect(onOutgoingInvoice).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toContain("<hibakod>KEY_ERR</hibakod>");
  });

  it("returns 500 when a handler throws so Szamlazz retries", async () => {
    const receiver = new FinancialDataReceiver({
      handlers: {
        onBankTransaction: () => {
          throw new Error("db down");
        },
      },
    });

    const res = await receiver.handle({ body: bankTranzXml });
    expect(res.status).toBe(500);
  });

  it("acknowledges unhandled types by default", async () => {
    const receiver = new FinancialDataReceiver({ handlers: {} });
    const res = await receiver.handle({ body: bankTranzXml });
    expect(res.status).toBe(200);
    expect(res.body).toContain("banktranzvalasz");
  });

  it("works as a Fetch Request handler", async () => {
    const receiver = new FinancialDataReceiver({
      handlers: { onOutgoingInvoice: () => ({ iktatoszam: "IKT-2" }) },
    });
    const request = new Request("https://example.com/szamlazz", {
      method: "POST",
      headers: { "content-type": "application/xml", "X-Szamlazzhu-Key": "K" },
      body: outgoingInvoiceXml,
    });
    const response = await receiver.webHandler(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("IKT-2");
  });

  it("returns 400 for an unrecognised package", async () => {
    const receiver = new FinancialDataReceiver({ handlers: {} });
    const res = await receiver.handle({ body: "<ismeretlen/>" });
    expect(res.status).toBe(400);
  });

  it("skips verification when no key is configured", async () => {
    const onReceipt = vi.fn();
    const receiver = new FinancialDataReceiver({ handlers: { onReceipt } });
    const res = await receiver.handle({
      body: `<nyugta><alap><id>1</id></alap></nyugta>`,
    });
    expect(res.status).toBe(200);
    expect(onReceipt).toHaveBeenCalledOnce();
  });

  it("supports a custom verifyKey predicate", async () => {
    const onBankTransaction = vi.fn();
    const receiver = new FinancialDataReceiver({
      verifyKey: (key) => key === "good",
      handlers: { onBankTransaction },
    });
    const denied = await receiver.handle({
      body: bankTranzXml,
      headers: { "x-szamlazzhu-key": "bad" },
    });
    expect(denied.body).toContain("KEY_ERR");
    expect(onBankTransaction).not.toHaveBeenCalled();

    const allowed = await receiver.handle({
      body: bankTranzXml,
      headers: { "x-szamlazzhu-key": "good" },
    });
    expect(allowed.status).toBe(200);
    expect(onBankTransaction).toHaveBeenCalledOnce();
  });

  it("reads the key from a Headers instance", async () => {
    const onBankTransaction = vi.fn();
    const receiver = new FinancialDataReceiver({
      key: "K",
      handlers: { onBankTransaction },
    });
    const headers = new Headers({ "X-Szamlazzhu-Key": "K" });
    const res = await receiver.handle({ body: bankTranzXml, headers });
    expect(res.status).toBe(200);
    expect(onBankTransaction).toHaveBeenCalledOnce();
  });

  it("returns 500 for unhandled types when acknowledgeUnhandled is false", async () => {
    const receiver = new FinancialDataReceiver({
      handlers: {},
      acknowledgeUnhandled: false,
    });
    const res = await receiver.handle({ body: bankTranzXml });
    expect(res.status).toBe(500);
  });

  it("passes context with the detected type and key to handlers", async () => {
    let seenType: string | undefined;
    let seenKey: string | undefined;
    const receiver = new FinancialDataReceiver({
      key: "K",
      handlers: {
        onOutgoingInvoice: (_inv, ctx) => {
          seenType = ctx.packageType;
          seenKey = ctx.key;
        },
      },
    });
    await receiver.handle({
      body: outgoingInvoiceXml,
      headers: { "x-szamlazzhu-key": "K" },
    });
    expect(seenType).toBe("outgoing-invoice");
    expect(seenKey).toBe("K");
  });
});
