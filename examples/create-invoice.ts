/**
 * Create an invoice, request the PDF, and save it to disk.
 *
 * Run (after `npm install szamlazz-agent`):
 *   SZAMLAZZ_AGENT_KEY=... npx tsx examples/create-invoice.ts
 */
import { writeFile } from "node:fs/promises";
import {
  SzamlazzClient,
  SzamlazzError,
  Language,
  Currency,
  PaymentMethod,
} from "szamlazz-agent";

const client = new SzamlazzClient({
  agentKey: process.env.SZAMLAZZ_AGENT_KEY!,
  timeoutMs: 30_000,
});

const today = new Date().toISOString().slice(0, 10);

try {
  const result = await client.createInvoice(
    {
      header: {
        issueDate: today,
        fulfillmentDate: today,
        paymentDeadline: today,
        paymentMethod: PaymentMethod.BankTransfer,
        currency: Currency.HUF,
        language: Language.Hungarian,
        comment: "Köszönjük a vásárlást!",
      },
      buyer: {
        name: "Teszt Vevő Kft.",
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
          quantity: 2,
          unit: "óra",
          netUnitPrice: 10_000,
          vatRate: 27,
          netAmount: 20_000,
          vatAmount: 5_400,
          grossAmount: 25_400,
        },
      ],
    },
    /* requestPdf */ true,
  );

  console.log("Számlaszám:", result.invoiceNumber);
  console.log("Bruttó:", result.grossTotal);

  if (result.pdf) {
    await writeFile(`${result.invoiceNumber}.pdf`, result.pdf);
    console.log("PDF mentve:", `${result.invoiceNumber}.pdf`);
  }
} catch (err) {
  if (err instanceof SzamlazzError) {
    console.error("Szamlazz hiba:", err.code, err.message);
    process.exit(1);
  }
  throw err;
}
