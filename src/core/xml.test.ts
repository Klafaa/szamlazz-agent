import { describe, it, expect } from "vitest";
import { escapeXml, leaf, elem, document } from "./xml.js";

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &apos; f",
    );
  });
});

describe("leaf", () => {
  it("renders primitives and skips null/undefined", () => {
    expect(leaf("a", "x")).toBe("<a>x</a>");
    expect(leaf("a", 12.5)).toBe("<a>12.5</a>");
    expect(leaf("a", true)).toBe("<a>true</a>");
    expect(leaf("a", false)).toBe("<a>false</a>");
    expect(leaf("a", null)).toBeNull();
    expect(leaf("a", undefined)).toBeNull();
  });
});

describe("elem", () => {
  it("drops null children and preserves order", () => {
    expect(elem("p", [leaf("a", "1"), leaf("b", null), leaf("c", "3")])).toBe(
      "<p><a>1</a><c>3</c></p>",
    );
  });

  it("returns null when empty unless keepEmpty", () => {
    expect(elem("p", [leaf("a", null)])).toBeNull();
    expect(elem("p", [leaf("a", null)], { keepEmpty: true })).toBe("<p></p>");
  });
});

describe("document", () => {
  it("emits a declaration and namespaced root", () => {
    const xml = document("xmlszamla", "http://www.szamlazz.hu/xmlszamla", [
      leaf("a", "1"),
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.szamlazz.hu/xmlszamla"');
    expect(xml).toContain("xsi:schemaLocation");
    expect(xml).toContain("<a>1</a>");
  });
});
