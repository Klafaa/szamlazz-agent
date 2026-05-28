import { leaf, elem } from "../core/xml.js";
import type { FdcAck, FdcPackageType } from "./types.js";

const DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';

const NS: Record<FdcPackageType, { root: string; ns: string }> = {
  "outgoing-invoice": {
    root: "szamlavalasz",
    ns: "http://www.szamlazz.hu/szamlavalasz",
  },
  "incoming-invoice": {
    root: "szamlabevalasz",
    ns: "http://www.szamlazz.hu/szamlabevalasz",
  },
  "bank-transaction": {
    root: "banktranzvalasz",
    ns: "http://www.szamlazz.hu/banktranzvalasz",
  },
  receipt: {
    root: "nyugtavalasz",
    ns: "http://www.szamlazz.hu/nyugtavalasz",
  },
};

/**
 * Builds the acknowledgment XML the receiver must return.
 *
 * Invoice types echo the received `<id>` inside `<alap>` (plus an optional
 * `<iktatoszam>`); bank-transaction and receipt acknowledgments carry only an
 * optional `<hibakod>`. Any type may report an error via `<hibakod>`.
 */
export function buildAck(
  packageType: FdcPackageType,
  id: string,
  ack: FdcAck = {},
): string {
  const { root, ns } = NS[packageType];
  const children: Array<string | null> = [];

  const isInvoice =
    packageType === "outgoing-invoice" || packageType === "incoming-invoice";

  if (!ack.error && isInvoice) {
    children.push(
      elem("alap", [leaf("id", id), leaf("iktatoszam", ack.iktatoszam)], {
        keepEmpty: true,
      }),
    );
  }
  if (ack.error) {
    children.push(leaf("hibakod", ack.error));
  }

  const body = elem(root, children, {
    attrs: { xmlns: ns },
    keepEmpty: true,
  });
  return DECL + body;
}
