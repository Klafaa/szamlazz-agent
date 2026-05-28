import { describe, it, expect, vi } from "vitest";
import { SzamlazzClient } from "./client.js";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

const ACTION_FIELDS = [
  "action-xmlagentxmlfile",
  "action-szamla_agent_st",
  "action-szamla_agent_kifiz",
  "action-szamla_agent_pdf",
  "action-szamla_agent_xml",
  "action-szamla_agent_dijbekero_torlese",
  "action-szamla_agent_nyugta_create",
  "action-szamla_agent_nyugta_storno",
  "action-szamla_agent_nyugta_get",
  "action-szamla_agent_nyugta_send",
  "action-szamla_agent_taxpayer",
] as const;

const RESPONSES: Record<string, string | Uint8Array> = {
  "action-xmlagentxmlfile": `<xmlszamlavalasz><sikeres>true</sikeres><szamlaszam>E-1</szamlaszam></xmlszamlavalasz>`,
  "action-szamla_agent_st": `<xmlszamlavalasz><sikeres>true</sikeres><szamlaszam>ST-1</szamlaszam></xmlszamlavalasz>`,
  "action-szamla_agent_kifiz": `<xmlszamlakifizvalasz><sikeres>true</sikeres></xmlszamlakifizvalasz>`,
  "action-szamla_agent_pdf": PDF_BYTES,
  "action-szamla_agent_xml": `<szamla><alap><szamlaszam>E-1</szamlaszam></alap></szamla>`,
  "action-szamla_agent_dijbekero_torlese": `<xmlszamladbkdelvalasz><sikeres>true</sikeres></xmlszamladbkdelvalasz>`,
  "action-szamla_agent_nyugta_create": `<xmlnyugtavalasz><sikeres>true</sikeres><nyugta><alap><nyugtaszam>NY-1</nyugtaszam></alap></nyugta></xmlnyugtavalasz>`,
  "action-szamla_agent_nyugta_storno": `<xmlnyugtavalasz><sikeres>true</sikeres><nyugta><alap><nyugtaszam>NY-1</nyugtaszam></alap></nyugta></xmlnyugtavalasz>`,
  "action-szamla_agent_nyugta_get": `<xmlnyugtavalasz><sikeres>true</sikeres><nyugta><alap><nyugtaszam>NY-1</nyugtaszam></alap></nyugta></xmlnyugtavalasz>`,
  "action-szamla_agent_nyugta_send": `<xmlnyugtavalasz><sikeres>true</sikeres></xmlnyugtavalasz>`,
  "action-szamla_agent_taxpayer": `<ns2:QueryTaxpayerResponse xmlns:ns2="x"><result><funcCode>OK</funcCode></result><ns2:taxpayerValidity>true</ns2:taxpayerValidity></ns2:QueryTaxpayerResponse>`,
};

/** Mock fetch that records which action field was used and replies accordingly. */
function makeClient() {
  let usedAction: string | undefined;
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const form = init.body as FormData;
    usedAction = ACTION_FIELDS.find((a) => form.has(a));
    const body = usedAction ? RESPONSES[usedAction] : "<x/>";
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return new Response(bytes, { status: 200 });
  });
  const client = new SzamlazzClient({
    agentKey: "KEY",
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client, getAction: () => usedAction };
}

const minimalInvoice = {
  header: { paymentMethod: "átutalás", currency: "HUF", language: "hu" },
  buyer: { name: "X", zip: "1011", city: "Bp", address: "Fő u. 1." },
  items: [
    {
      name: "i",
      quantity: 1,
      unit: "db",
      netUnitPrice: 1,
      vatRate: 27,
      netAmount: 1,
      vatAmount: 0,
      grossAmount: 1,
    },
  ],
};

const minimalReceipt = {
  prefix: "NYGTA",
  paymentMethod: "készpénz",
  currency: "HUF",
  items: [
    {
      name: "i",
      quantity: 1,
      unit: "db",
      netUnitPrice: 1,
      netAmount: 1,
      vatRate: 27,
      vatAmount: 0,
      grossAmount: 1,
    },
  ],
};

describe("SzamlazzClient action routing", () => {
  it("createInvoice -> action-xmlagentxmlfile", async () => {
    const { client, getAction } = makeClient();
    await client.createInvoice(minimalInvoice);
    expect(getAction()).toBe("action-xmlagentxmlfile");
  });

  it("reverseInvoice -> action-szamla_agent_st", async () => {
    const { client, getAction } = makeClient();
    const r = await client.reverseInvoice({ invoiceNumber: "E-1" });
    expect(getAction()).toBe("action-szamla_agent_st");
    expect(r.invoiceNumber).toBe("ST-1");
  });

  it("registerPayment -> action-szamla_agent_kifiz", async () => {
    const { client, getAction } = makeClient();
    await client.registerPayment({
      invoiceNumber: "E-1",
      entries: [{ date: "2026-06-01", title: "átutalás", amount: 1 }],
    });
    expect(getAction()).toBe("action-szamla_agent_kifiz");
  });

  it("getInvoicePdf -> action-szamla_agent_pdf", async () => {
    const { client, getAction } = makeClient();
    const pdf = await client.getInvoicePdf({ invoiceNumber: "E-1" });
    expect(getAction()).toBe("action-szamla_agent_pdf");
    expect(Array.from(pdf)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("getInvoiceXml -> action-szamla_agent_xml", async () => {
    const { client, getAction } = makeClient();
    const r = await client.getInvoiceXml({ invoiceNumber: "E-1" });
    expect(getAction()).toBe("action-szamla_agent_xml");
    expect(r.raw).toContain("<szamla>");
  });

  it("deleteProforma -> action-szamla_agent_dijbekero_torlese", async () => {
    const { client, getAction } = makeClient();
    await client.deleteProforma({ proformaNumber: "D-1" });
    expect(getAction()).toBe("action-szamla_agent_dijbekero_torlese");
  });

  it("createReceipt -> action-szamla_agent_nyugta_create", async () => {
    const { client, getAction } = makeClient();
    const r = await client.createReceipt(minimalReceipt);
    expect(getAction()).toBe("action-szamla_agent_nyugta_create");
    expect(r.receiptNumber).toBe("NY-1");
  });

  it("reverseReceipt -> action-szamla_agent_nyugta_storno", async () => {
    const { client, getAction } = makeClient();
    await client.reverseReceipt("NY-1");
    expect(getAction()).toBe("action-szamla_agent_nyugta_storno");
  });

  it("getReceipt -> action-szamla_agent_nyugta_get", async () => {
    const { client, getAction } = makeClient();
    await client.getReceipt("NY-1");
    expect(getAction()).toBe("action-szamla_agent_nyugta_get");
  });

  it("sendReceipt -> action-szamla_agent_nyugta_send", async () => {
    const { client, getAction } = makeClient();
    await client.sendReceipt({ receiptNumber: "NY-1", email: "a@b.hu" });
    expect(getAction()).toBe("action-szamla_agent_nyugta_send");
  });

  it("queryTaxpayer -> action-szamla_agent_taxpayer", async () => {
    const { client, getAction } = makeClient();
    const r = await client.queryTaxpayer("12345678");
    expect(getAction()).toBe("action-szamla_agent_taxpayer");
    expect(r.valid).toBe(true);
  });
});
