import { describe, it, expect } from "vitest";
import { buildAck } from "./response.js";
import { FdcErrorCode } from "./types.js";

describe("buildAck", () => {
  it("incoming-invoice echoes id inside szamlabevalasz", () => {
    const xml = buildAck("incoming-invoice", "2002", { iktatoszam: "IKT-2" });
    expect(xml).toContain('<szamlabevalasz xmlns="http://www.szamlazz.hu/szamlabevalasz">');
    expect(xml).toContain("<id>2002</id>");
    expect(xml).toContain("<iktatoszam>IKT-2</iktatoszam>");
  });

  it("omits iktatoszam when not provided but keeps the id", () => {
    const xml = buildAck("outgoing-invoice", "1001");
    expect(xml).toContain("<alap><id>1001</id></alap>");
    expect(xml).not.toContain("iktatoszam");
  });

  it("receipt ack is an empty nyugtavalasz envelope", () => {
    const xml = buildAck("receipt", "3003");
    expect(xml).toContain('<nyugtavalasz xmlns="http://www.szamlazz.hu/nyugtavalasz">');
    expect(xml).not.toContain("<alap>");
    expect(xml).not.toContain("<id>");
  });

  it("reports KEY_DEL via hibakod and drops alap", () => {
    const xml = buildAck("outgoing-invoice", "1001", {
      error: FdcErrorCode.DeleteKey,
    });
    expect(xml).toContain("<hibakod>KEY_DEL</hibakod>");
    expect(xml).not.toContain("<alap>");
  });

  it("starts with an XML declaration", () => {
    expect(buildAck("bank-transaction", "55")).toMatch(/^<\?xml /);
  });
});
