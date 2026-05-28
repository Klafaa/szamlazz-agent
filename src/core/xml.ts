/**
 * Minimal ordered XML builder.
 *
 * The Szamla Agent XSDs use `xsd:sequence`, so element order is significant:
 * an out-of-order element fails validation. We therefore build XML from
 * explicitly ordered arrays rather than from plain objects, and drop any
 * `null`/`undefined` leaf so optional fields can be omitted cleanly.
 */

export type XmlValue = string | number | boolean | null | undefined;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatValue(value: Exclude<XmlValue, null | undefined>): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return escapeXml(String(value));
}

/** A single leaf element, or `null` when the value is absent (skipped). */
export function leaf(name: string, value: XmlValue): string | null {
  if (value === null || value === undefined) return null;
  return `<${name}>${formatValue(value)}</${name}>`;
}

/**
 * A container element wrapping ordered children. `null` children are dropped.
 * Returns `null` when every child is absent and `keepEmpty` is false.
 */
export function elem(
  name: string,
  children: Array<string | null>,
  opts: { attrs?: Record<string, string>; keepEmpty?: boolean } = {},
): string | null {
  const rendered = children.filter((c): c is string => c !== null);
  if (rendered.length === 0 && !opts.keepEmpty) return null;
  const attrs = opts.attrs
    ? " " +
      Object.entries(opts.attrs)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(" ")
    : "";
  return `<${name}${attrs}>${rendered.join("")}</${name}>`;
}

/** Builds a full document with the XML declaration and a namespaced root. */
export function document(
  root: string,
  namespace: string,
  children: Array<string | null>,
): string {
  const attrs = {
    xmlns: namespace,
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "xsi:schemaLocation": `${namespace} ${schemaLocation(root)}`,
  };
  const body = elem(root, children, { attrs, keepEmpty: true });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

function schemaLocation(root: string): string {
  return `https://www.szamlazz.hu/szamla/docs/xsds/agent/${root}.xsd`;
}
