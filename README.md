# szamlazz-agent

[![CI](https://github.com/Klafaa/szamlazz-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Klafaa/szamlazz-agent/actions/workflows/ci.yml)

TypeScript client for the [Szamlazz.hu Szamla Agent API](https://docs.szamlazz.hu/hu/agent/) and the [Penzugyi adatkapcsolat](https://docs.szamlazz.hu/hu/penzugyi-adatkapcsolat) (Financial Data Connection) receiver. Authenticates with an **Agent key (token)** — no username/password.

- Full operation coverage: invoice create/storno, payment registration, PDF & XML retrieval, proforma deletion, receipt create/storno/get/send, taxpayer lookup.
- Financial Data Connection PUSH receiver (`FinancialDataReceiver`).
- Typed request options and parsed responses.
- Native `fetch` — no HTTP dependency. Works on Node 18+.
- Dual ESM / CommonJS build with type declarations.

Runnable examples live in [`examples/`](examples/).

## Install

```bash
npm install szamlazz-agent
```

## Quick start

```ts
import { SzamlazzClient, Language, Currency, PaymentMethod } from "szamlazz-agent";

const client = new SzamlazzClient({ agentKey: process.env.SZAMLAZZ_AGENT_KEY! });

const invoice = await client.createInvoice(
  {
    header: {
      paymentMethod: PaymentMethod.BankTransfer,
      currency: Currency.HUF,
      language: Language.Hungarian,
      fulfillmentDate: "2026-05-28",
      paymentDeadline: "2026-06-11",
    },
    buyer: {
      name: "Teszt Kft.",
      zip: "1011",
      city: "Budapest",
      address: "Fő utca 1.",
      taxNumber: "12345678-2-41",
      email: "vevo@example.com",
      sendEmail: true,
    },
    items: [
      {
        name: "Tanácsadás",
        quantity: 1,
        unit: "óra",
        netUnitPrice: 10000,
        vatRate: 27,
        netAmount: 10000,
        vatAmount: 2700,
        grossAmount: 12700,
      },
    ],
  },
  /* requestPdf */ true,
);

console.log(invoice.invoiceNumber, invoice.grossTotal);
if (invoice.pdf) {
  await import("node:fs/promises").then((fs) =>
    fs.writeFile("invoice.pdf", invoice.pdf!),
  );
}
```

## Client options

```ts
new SzamlazzClient({
  agentKey: "...",        // required — Szamla Agent kulcs
  endpoint: "https://www.szamlazz.hu/szamla/", // optional override
  fetch: customFetch,     // optional fetch implementation
  timeoutMs: 30000,       // optional per-request timeout
});
```

## Operations

| Method | Description |
| --- | --- |
| `createInvoice(opts, requestPdf?)` | Create an invoice or proforma (`xmlszamla`). |
| `reverseInvoice(opts, requestPdf?)` | Cancel an invoice with a storno (`xmlszamlast`). |
| `registerPayment(opts)` | Register a payment / credit entry (`xmlszamlakifiz`). |
| `getInvoicePdf(selector)` | Download an existing invoice PDF (`xmlszamlapdf`). |
| `getInvoiceXml(selector)` | Retrieve an invoice as parsed XML (`xmlszamlaxml`). |
| `deleteProforma(opts)` | Delete a proforma (`xmlszamladbkdel`). |
| `createReceipt(opts, requestPdf?)` | Create a receipt (`xmlnyugtacreate`). |
| `reverseReceipt(number, requestPdf?)` | Cancel a receipt (`xmlnyugtast`). |
| `getReceipt(number, requestPdf?)` | Query a receipt (`xmlnyugtaget`). |
| `sendReceipt(opts)` | E-mail a receipt (`xmlnyugtasend`). |
| `queryTaxpayer(taxNumber)` | NAV taxpayer lookup (`xmltaxpayer`). |

### Examples

```ts
// Storno
await client.reverseInvoice({ invoiceNumber: "E-2026-1" });

// Register a payment
await client.registerPayment({
  invoiceNumber: "E-2026-1",
  entries: [{ date: "2026-06-01", title: "átutalás", amount: 12700 }],
});

// Download an existing PDF
const pdf = await client.getInvoicePdf({ invoiceNumber: "E-2026-1" });

// Receipt (prefix is required — must be a receipt block configured in the account)
const receipt = await client.createReceipt({
  prefix: "NYGTA",
  paymentMethod: "készpénz",
  currency: "HUF",
  items: [
    {
      name: "Termék",
      quantity: 2,
      unit: "db",
      netUnitPrice: 1000,
      netAmount: 2000,
      vatRate: 27,
      vatAmount: 540,
      grossAmount: 2540,
    },
  ],
});

// Taxpayer lookup
const tp = await client.queryTaxpayer("13421739");
console.log(tp.valid, tp.queryStatus, tp.name);
```

## Financial Data Connection (Pénzügyi adatkapcsolat)

The package also implements the receiver side of the
[Pénzügyi adatkapcsolat 5.0](https://docs.szamlazz.hu/hu/penzugyi-adatkapcsolat)
PUSH interface. Szamlazz.hu POSTs an `application/xml` package (outgoing
invoice, incoming invoice, bank transaction, or receipt) to a URL you register,
with the identification key in the `X-Szamlazzhu-Key` header. Your endpoint must
reply with **HTTP 200** and a type-specific acknowledgment XML that echoes the
received `<id>`. `FinancialDataReceiver` handles parsing, key verification, and
building that acknowledgment.

```ts
import { FinancialDataReceiver } from "szamlazz-agent";

const receiver = new FinancialDataReceiver({
  key: process.env.SZAMLAZZ_FDC_KEY, // expected X-Szamlazzhu-Key (or string[])
  handlers: {
    async onOutgoingInvoice(invoice) {
      await db.invoices.save(invoice.base, invoice.items);
      // The booking number is echoed back to Szamlazz.hu (optional).
      return { iktatoszam: "IKT-" + invoice.id };
    },
    async onBankTransaction(tx) {
      await db.transactions.save(tx);
    },
    async onReceipt(receipt) {
      await db.receipts.save(receipt);
    },
  },
});
```

With the Fetch API (Next.js route handler, Hono, Bun, Deno, edge functions):

```ts
export async function POST(request: Request) {
  return receiver.webHandler(request);
}
```

With Express (read the raw body as text first):

```ts
import express from "express";

app.post(
  "/szamlazz/fdc",
  express.text({ type: "application/xml" }),
  async (req, res) => {
    const result = await receiver.handle({ body: req.body, headers: req.headers });
    res.status(result.status).type(result.contentType).send(result.body);
  },
);
```

Notes:
- Each parsed package exposes typed fields plus `.raw` (the full parsed XML), so
  no data is lost even for fields not modelled explicitly.
- A non-matching key is acknowledged with `hibakod` = `KEY_ERR`, which stops
  resubmission. Return `{ error: FdcErrorCode.DeleteKey }` from a handler to ask
  Szamlazz.hu to remove the connection.
- If a handler throws, the receiver responds with HTTP 500 so Szamlazz.hu retries
  (within its 72-hour window) instead of dropping the package.

## Error handling

All failures throw `SzamlazzError`, which carries the Agent error `code`, the
`httpStatus`, and the raw `responseBody` when available.

```ts
import { SzamlazzError } from "szamlazz-agent";

try {
  await client.getInvoicePdf({ invoiceNumber: "missing" });
} catch (err) {
  if (err instanceof SzamlazzError) {
    console.error(err.code, err.message);
  }
}
```

## Notes

- Amounts and VAT are sent exactly as provided; compute line totals yourself so
  they match the Agent's own validation (`quantity × unit price`, VAT, gross).
- `requestPdf` defaults to `false` to avoid transferring PDFs you don't need.
  When `true`, the PDF bytes are returned on the `pdf` field of the result.
- This is an unofficial client and is not affiliated with Szamlazz.hu / KBOSS.hu.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
