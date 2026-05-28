import { describe, it, expect } from "vitest";
import { detectPackageType, parsePackage } from "./parse.js";

const incomingInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<szamlabe xmlns="http://www.szamlazz.hu/szamlabe">
  <alap><id>2002</id><szamlaszam>BE-1</szamlaszam></alap>
</szamlabe>`;

const receiptArchiveXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlnyugtaarchiv xmlns="http://www.szamlazz.hu/xmlnyugtaarchiv">
  <nyugta>
    <alap><id>3003</id><nyugtaszam>NY-1</nyugtaszam><fizmod>készpénz</fizmod></alap>
    <tetelek><tetel><megnevezes>Termek</megnevezes><brutto>1270</brutto></tetel></tetelek>
  </nyugta>
</xmlnyugtaarchiv>`;

describe("detectPackageType", () => {
  it("maps each root element to its type", () => {
    expect(detectPackageType(incomingInvoiceXml)).toBe("incoming-invoice");
    expect(detectPackageType(receiptArchiveXml)).toBe("receipt");
    expect(detectPackageType("<banktranz><id>1</id></banktranz>")).toBe(
      "bank-transaction",
    );
    expect(detectPackageType("<ismeretlen/>")).toBeUndefined();
  });
});

describe("parsePackage", () => {
  it("parses an incoming invoice", () => {
    const pkg = parsePackage(incomingInvoiceXml);
    expect(pkg.type).toBe("incoming-invoice");
    expect(pkg.id).toBe("2002");
    if (pkg.type === "incoming-invoice") {
      expect(pkg.base["szamlaszam"]).toBe("BE-1");
    }
  });

  it("unwraps a receipt from xmlnyugtaarchiv", () => {
    const pkg = parsePackage(receiptArchiveXml);
    expect(pkg.type).toBe("receipt");
    expect(pkg.id).toBe("3003");
    if (pkg.type === "receipt") {
      expect(pkg.base["nyugtaszam"]).toBe("NY-1");
      expect(pkg.items).toHaveLength(1);
    }
  });

  it("parses a bare <nyugta> root", () => {
    const pkg = parsePackage(
      `<nyugta><alap><id>9</id><nyugtaszam>NY-9</nyugtaszam></alap></nyugta>`,
    );
    expect(pkg.type).toBe("receipt");
    expect(pkg.id).toBe("9");
  });

  it("throws on an unrecognised root element", () => {
    expect(() => parsePackage("<ismeretlen><id>1</id></ismeretlen>")).toThrow(
      /Unrecognised/,
    );
  });
});
