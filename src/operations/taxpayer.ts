import { document, elem, leaf } from "../core/xml.js";
import { parseXml } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

export interface TaxpayerResult {
  /** NAV query status (`result/funcCode`), e.g. "OK" or "ERROR". */
  queryStatus?: string;
  /** Whether the tax number is valid / known (`taxpayerValidity`). */
  valid: boolean;
  /** Taxpayer name, when available (`taxpayerData/taxpayerName`). */
  name?: string;
  /** Parsed taxpayer data block (`taxpayerData`), when available. */
  taxpayerData?: Record<string, unknown>;
  /** Raw XML response. */
  raw: string;
}

const NS = "http://www.szamlazz.hu/xmltaxpayer";

export function buildQueryTaxpayerXml(
  agentKey: string,
  taxNumber: string,
): string {
  const beallitasok = elem("beallitasok", [leaf("szamlaagentkulcs", agentKey)]);
  const torzsszam = leaf("torzsszam", taxNumber);
  return document("xmltaxpayer", NS, [beallitasok, torzsszam]);
}

export function parseQueryTaxpayerResponse(res: RawResponse): TaxpayerResult {
  const parsed = parseXml<Record<string, any>>(res.text);
  // The parser strips namespace prefixes, so the NAV root is QueryTaxpayerResponse.
  const rootKey = Object.keys(parsed).find((k) =>
    k.endsWith("QueryTaxpayerResponse"),
  );
  const root = rootKey ? parsed[rootKey] : undefined;

  const queryStatus: string | undefined = root?.["result"]?.["funcCode"];
  const validity = root?.["taxpayerValidity"];
  const taxpayerData = root?.["taxpayerData"];

  return {
    queryStatus,
    valid: validity === "true" || validity === true,
    name: taxpayerData?.["taxpayerName"],
    taxpayerData,
    raw: res.text,
  };
}
