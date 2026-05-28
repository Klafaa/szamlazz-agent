import { describe, it, expect, vi } from "vitest";
import { postXml, DEFAULT_ENDPOINT } from "./transport.js";
import { SzamlazzError } from "./errors.js";

function res(
  body: string | Uint8Array,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Response(bytes, { status, headers });
}

describe("postXml", () => {
  it("uploads the XML as a named file under the action field", async () => {
    let captured: FormData | undefined;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(DEFAULT_ENDPOINT);
      expect(init.method).toBe("POST");
      captured = init.body as FormData;
      return res("<ok/>");
    });

    await postXml("action-xmlagentxmlfile", "<xmlszamla/>", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    const file = captured!.get("action-xmlagentxmlfile");
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe("request.xml");
    expect(await (file as Blob).text()).toBe("<xmlszamla/>");
  });

  it("returns body, lower-cased headers, and decoded text on success", async () => {
    const fetchMock = vi.fn(async () =>
      res("<valasz/>", { "Szlahu_Szamlaszam": "E-2026-1" }),
    );
    const out = await postXml("action-szamla_agent_pdf", "<x/>", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(out.text).toBe("<valasz/>");
    expect(out.headers["szlahu_szamlaszam"]).toBe("E-2026-1");
    expect(out.body).toBeInstanceOf(Uint8Array);
  });

  it("throws SzamlazzError with decoded message and code on error headers", async () => {
    const fetchMock = vi.fn(async () =>
      res("err", {
        szlahu_error_code: "57",
        szlahu_error: "Nincs%20ilyen%20szamla",
      }),
    );
    await expect(
      postXml("action-szamla_agent_pdf", "<x/>", {
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      name: "SzamlazzError",
      code: 57,
      message: "Nincs ilyen szamla",
    });
  });

  it("does not treat szlahu_error_code 0 as an error", async () => {
    const fetchMock = vi.fn(async () => res("<ok/>", { szlahu_error_code: "0" }));
    const out = await postXml("action-xmlagentxmlfile", "<x/>", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(out.text).toBe("<ok/>");
  });

  it("throws on non-2xx status without error headers", async () => {
    const fetchMock = vi.fn(async () => res("oops", {}, 500));
    await expect(
      postXml("action-xmlagentxmlfile", "<x/>", {
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP status 500/);
  });

  it("wraps network failures in SzamlazzError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      postXml("action-xmlagentxmlfile", "<x/>", {
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(SzamlazzError);
  });

  it("honours a custom endpoint", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://example.test/szamla/");
      return res("<ok/>");
    });
    await postXml("action-xmlagentxmlfile", "<x/>", {
      endpoint: "https://example.test/szamla/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
