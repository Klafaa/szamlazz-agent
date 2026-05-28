import { SzamlazzError } from "./errors.js";

export const DEFAULT_ENDPOINT = "https://www.szamlazz.hu/szamla/";

/** Form field name that tells the Agent which operation to run. */
export type ActionField =
  | "action-xmlagentxmlfile" // invoice creation
  | "action-szamla_agent_st" // invoice cancellation (storno)
  | "action-szamla_agent_kifiz" // credit entry / payment
  | "action-szamla_agent_pdf" // pdf retrieval
  | "action-szamla_agent_xml" // xml retrieval
  | "action-szamla_agent_dijbekero_torlese" // proforma deletion
  | "action-szamla_agent_nyugta_create" // receipt creation
  | "action-szamla_agent_nyugta_storno" // receipt cancellation
  | "action-szamla_agent_nyugta_get" // receipt query
  | "action-szamla_agent_nyugta_send" // receipt e-mailing
  | "action-szamla_agent_taxpayer"; // taxpayer / tax-number query

export interface RawResponse {
  /** Raw response body bytes (PDF binary or XML, depending on operation). */
  body: Uint8Array;
  /** Lower-cased response headers. */
  headers: Record<string, string>;
  /** Response body decoded as UTF-8 text (cheap; PDF callers can ignore it). */
  text: string;
}

export interface TransportOptions {
  endpoint?: string;
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Posts an XML payload to the Szamla Agent as a multipart upload and returns
 * the raw response. Throws {@link SzamlazzError} on transport failures and on
 * any `szlahu_error_code` reported in the response headers.
 */
export async function postXml(
  action: ActionField,
  xml: string,
  options: TransportOptions = {},
): Promise<RawResponse> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new SzamlazzError(
      "No fetch implementation available. Use Node 18+ or pass `fetch` in options.",
    );
  }

  const form = new FormData();
  const blob = new Blob([xml], { type: "application/xml" });
  form.append(action, blob, "request.xml");

  const controller = new AbortController();
  const timeout =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new SzamlazzError(
      `Request to Szamla Agent failed: ${(err as Error).message}`,
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const buffer = new Uint8Array(await res.arrayBuffer());
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const errorCode = headers["szlahu_error_code"];
  const errorMessage = headers["szlahu_error"];
  const hasError = (errorCode && errorCode !== "0") || Boolean(errorMessage);
  if (hasError) {
    throw new SzamlazzError(decodeHeader(errorMessage) || "Szamla Agent error", {
      code: errorCode ? Number(errorCode) : undefined,
      httpStatus: res.status,
      responseBody: safeText(buffer),
    });
  }

  if (!res.ok) {
    throw new SzamlazzError(`Unexpected HTTP status ${res.status}`, {
      httpStatus: res.status,
      responseBody: safeText(buffer),
    });
  }

  return { body: buffer, headers, text: safeText(buffer) };
}

function safeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/** Agent error headers are URL-encoded; decode best-effort. */
function decodeHeader(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}
