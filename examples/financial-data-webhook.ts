/**
 * Receiver for the Penzugyi adatkapcsolat (Financial Data Connection) PUSH
 * interface. Szamlazz.hu POSTs application/xml packages to your registered URL
 * with an `X-Szamlazzhu-Key` header; you must reply HTTP 200 with the
 * acknowledgment XML. `FinancialDataReceiver` builds that reply for you.
 *
 * Two transports are shown: a Fetch-based handler (Next.js / Hono / Bun / Deno)
 * and a Node `http` server. Pick one.
 */
import { createServer } from "node:http";
import { FinancialDataReceiver, FdcErrorCode } from "szamlazz-agent";

const receiver = new FinancialDataReceiver({
  // Identification key(s) you set in your Szamlazz.hu account. Use an array to
  // accept several clients on one endpoint, or `verifyKey` for a DB lookup.
  key: process.env.SZAMLAZZ_FDC_KEY,
  handlers: {
    async onOutgoingInvoice(invoice) {
      console.log("Kimenő számla:", invoice.id, invoice.base["szamlaszam"]);
      // ... persist invoice.base / invoice.items / invoice.raw ...
      // Return a booking number to echo back (optional):
      return { iktatoszam: `IKT-${invoice.id}` };
    },
    async onIncomingInvoice(invoice) {
      console.log("Bejövő számla:", invoice.id);
      return { iktatoszam: `IKT-${invoice.id}` };
    },
    async onBankTransaction(tx) {
      console.log("Banki tranzakció:", tx.id, tx.direction, tx.amount, tx.currency);
    },
    async onReceipt(receipt) {
      console.log("Nyugta:", receipt.id, receipt.base["nyugtaszam"]);
    },
  },
});

// --- Option A: Fetch API (Next.js route handler / Hono / Bun / Deno) ---------
// export async function POST(request: Request) {
//   return receiver.webHandler(request);
// }

// --- Option B: Node http server ----------------------------------------------
const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const result = await receiver.handle({ body, headers: req.headers });
    res.writeHead(result.status, { "content-type": result.contentType });
    res.end(result.body);
  });
});

server.listen(3000, () => console.log("FDC receiver listening on :3000"));

// Reference: returning an error from a handler replies with <hibakod>:
//   return { error: FdcErrorCode.DeleteKey };
void FdcErrorCode;
