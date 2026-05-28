/**
 * Receipt lifecycle: create, e-mail, query, and cancel (storno).
 *
 * Run:
 *   SZAMLAZZ_AGENT_KEY=... npx tsx examples/receipt.ts
 *
 * Note: `prefix` must be a receipt block prefix configured in your account
 * (max 5 chars, uppercase letters and digits) that is NOT already used for
 * invoices.
 */
import { SzamlazzClient } from "szamlazz-agent";

const client = new SzamlazzClient({ agentKey: process.env.SZAMLAZZ_AGENT_KEY! });

const created = await client.createReceipt(
  {
    prefix: "NYGTA",
    paymentMethod: "készpénz",
    currency: "HUF",
    items: [
      {
        name: "Termék",
        quantity: 2,
        unit: "db",
        netUnitPrice: 1_000,
        netAmount: 2_000,
        vatRate: 27,
        vatAmount: 540,
        grossAmount: 2_540,
      },
    ],
    payments: [{ method: "készpénz", amount: 2_540 }],
  },
  /* requestPdf */ true,
);
console.log("Nyugtaszám:", created.receiptNumber, "PDF:", created.pdf?.length, "byte");

// E-mail the receipt to the customer.
await client.sendReceipt({
  receiptNumber: created.receiptNumber!,
  email: "vevo@example.com",
});

// Query it back.
const fetched = await client.getReceipt(created.receiptNumber!);
console.log("Lekérdezve:", fetched.receiptNumber);

// Cancel (storno) it.
const reversed = await client.reverseReceipt(created.receiptNumber!);
console.log("Storno nyugtaszám:", reversed.receiptNumber);
