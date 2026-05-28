import { describe, it, expect, vi } from "vitest";
import { SzamlazzClient } from "./client.js";
import { SzamlazzError } from "./core/errors.js";

function mockResponse(
  body: string | Uint8Array,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  const bytes =
    typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Response(bytes, { status, headers });
}

describe("SzamlazzClient", () => {
  it("requires an agent key", () => {
    // @ts-expect-error testing runtime guard
    expect(() => new SzamlazzClient({})).toThrow(SzamlazzError);
  });

  it("posts the invoice under the correct action field and parses the response", async () => {
    const fetchMock = vi.fn(async (_url, init: RequestInit) => {
      const form = init.body as FormData;
      expect(form.has("action-xmlagentxmlfile")).toBe(true);
      return mockResponse(
        `<?xml version="1.0"?><xmlszamlavalasz><sikeres>true</sikeres>` +
          `<szamlaszam>E-2026-1</szamlaszam><szamlabrutto>12700</szamlabrutto>` +
          `</xmlszamlavalasz>`,
      );
    });

    const client = new SzamlazzClient({
      agentKey: "KEY",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.createInvoice({
      header: {
        paymentMethod: "átutalás",
        currency: "HUF",
        language: "hu",
      },
      buyer: { name: "X", zip: "1011", city: "Bp", address: "Fő u. 1." },
      items: [
        {
          name: "item",
          quantity: 1,
          unit: "db",
          netUnitPrice: 10000,
          vatRate: 27,
          netAmount: 10000,
          vatAmount: 2700,
          grossAmount: 12700,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBe("E-2026-1");
    expect(result.grossTotal).toBe("12700");
  });

  it("throws SzamlazzError when the error header is present", async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse("hiba", {
        szlahu_error_code: "57",
        szlahu_error: "Nincs%20ilyen%20szamla",
      }),
    );
    const client = new SzamlazzClient({
      agentKey: "KEY",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getInvoicePdf({ invoiceNumber: "X" })).rejects.toThrow(
      /Nincs ilyen szamla/,
    );
  });

  it("returns raw PDF bytes for a pdf query", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
    const fetchMock = vi.fn(async () => mockResponse(pdf));
    const client = new SzamlazzClient({
      agentKey: "KEY",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const bytes = await client.getInvoicePdf({ invoiceNumber: "E-2026-1" });
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
