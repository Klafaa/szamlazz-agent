// Live smoke test against the Szamlazz.hu demo Agent. Run with:
//   SZAMLAZZ_KEY=... node scripts/smoke.mjs [step]
// Reads the key from the environment so it is never written to disk.
import { SzamlazzClient, SzamlazzError } from "../dist/index.js";

const key = process.env.SZAMLAZZ_KEY;
if (!key) {
  console.error("Missing SZAMLAZZ_KEY env var.");
  process.exit(1);
}

const step = process.argv[2] ?? "taxpayer";
const client = new SzamlazzClient({ agentKey: key, timeoutMs: 30000 });

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function taxpayer() {
  // KBOSS.hu (Szamlazz.hu) tax number: 13421739-2-41
  const r = await client.queryTaxpayer("13421739");
  console.log("taxpayer:", JSON.stringify({ valid: r.valid, code: r.resultCode }));
  console.log("FULL RAW:\n", r.raw);
}

async function createInvoice() {
  const r = await client.createInvoice(
    {
      header: {
        issueDate: today(),
        fulfillmentDate: today(),
        paymentDeadline: today(),
        paymentMethod: "átutalás",
        currency: "HUF",
        language: "hu",
        comment: "Demo smoke test invoice",
      },
      seller: { emailReplyTo: "", emailSubject: "", emailText: "" },
      buyer: {
        name: "Teszt Vevő Kft.",
        zip: "1011",
        city: "Budapest",
        address: "Fő utca 1.",
      },
      items: [
        {
          name: "Smoke teszt tétel",
          quantity: 1,
          unit: "db",
          netUnitPrice: 1000,
          vatRate: 27,
          netAmount: 1000,
          vatAmount: 270,
          grossAmount: 1270,
        },
      ],
    },
    true, // request PDF
  );
  console.log(
    "createInvoice:",
    JSON.stringify({
      success: r.success,
      invoiceNumber: r.invoiceNumber,
      net: r.netTotal,
      gross: r.grossTotal,
      pdfBytes: r.pdf?.length,
    }),
  );
  return r.invoiceNumber;
}

async function createReceipt() {
  const r = await client.createReceipt(
    {
      prefix: process.env.SZAMLAZZ_RECEIPT_PREFIX ?? "NYGTA",
      paymentMethod: "készpénz",
      currency: "HUF",
      items: [
        {
          name: "Smoke nyugta tétel",
          quantity: 1,
          unit: "db",
          netUnitPrice: 1000,
          netAmount: 1000,
          vatRate: 27,
          vatAmount: 270,
          grossAmount: 1270,
        },
      ],
    },
    true,
  );
  console.log(
    "createReceipt:",
    JSON.stringify({
      success: r.success,
      receiptNumber: r.receiptNumber,
      pdfBytes: r.pdf?.length,
    }),
  );
}

async function full() {
  const number = await createInvoice();
  if (!number) throw new Error("No invoice number returned");

  const pdf = await client.getInvoicePdf({ invoiceNumber: number });
  console.log("getInvoicePdf:", JSON.stringify({ pdfBytes: pdf.length }));

  const xml = await client.getInvoiceXml({ invoiceNumber: number });
  console.log("getInvoiceXml: raw length", xml.raw.length);

  const storno = await client.reverseInvoice({ invoiceNumber: number }, false);
  console.log(
    "reverseInvoice:",
    JSON.stringify({ success: storno.success, invoiceNumber: storno.invoiceNumber }),
  );
}

async function getReceipt() {
  const number = process.env.SZAMLAZZ_RECEIPT_NUMBER;
  if (!number) throw new Error("Set SZAMLAZZ_RECEIPT_NUMBER");
  const r = await client.getReceipt(number);
  console.log(
    "getReceipt:",
    JSON.stringify({ success: r.success, receiptNumber: r.receiptNumber }),
  );
}

async function payment() {
  const number = await createInvoice();
  const r = await client.registerPayment({
    invoiceNumber: number,
    entries: [{ date: today(), title: "átutalás", amount: 1270 }],
  });
  console.log("registerPayment:", JSON.stringify({ success: r.success }));
}

async function proforma() {
  const r = await client.createInvoice({
    header: {
      issueDate: today(),
      fulfillmentDate: today(),
      paymentDeadline: today(),
      paymentMethod: "átutalás",
      currency: "HUF",
      language: "hu",
      proforma: true,
    },
    buyer: { name: "Teszt Vevő Kft.", zip: "1011", city: "Budapest", address: "Fő utca 1." },
    items: [
      {
        name: "Díjbekérő tétel",
        quantity: 1,
        unit: "db",
        netUnitPrice: 1000,
        vatRate: 27,
        netAmount: 1000,
        vatAmount: 270,
        grossAmount: 1270,
      },
    ],
  });
  console.log("createProforma:", JSON.stringify({ number: r.invoiceNumber }));
  const del = await client.deleteProforma({ proformaNumber: r.invoiceNumber });
  console.log("deleteProforma:", JSON.stringify({ success: del.success }));
}

async function receiptLifecycle() {
  const prefix = process.env.SZAMLAZZ_RECEIPT_PREFIX ?? "NYGTA";
  const email = process.env.SZAMLAZZ_EMAIL;
  if (!email) throw new Error("Set SZAMLAZZ_EMAIL");

  const created = await client.createReceipt({
    prefix,
    paymentMethod: "készpénz",
    currency: "HUF",
    items: [
      {
        name: "Email teszt nyugta tétel",
        quantity: 1,
        unit: "db",
        netUnitPrice: 1000,
        netAmount: 1000,
        vatRate: 27,
        vatAmount: 270,
        grossAmount: 1270,
      },
    ],
  });
  console.log("createReceipt:", JSON.stringify({ number: created.receiptNumber }));

  const sent = await client.sendReceipt({
    receiptNumber: created.receiptNumber,
    email,
  });
  console.log("sendReceipt:", JSON.stringify({ success: sent.success, to: email }));

  const reversed = await client.reverseReceipt(created.receiptNumber, false);
  console.log(
    "reverseReceipt:",
    JSON.stringify({ success: reversed.success, number: reversed.receiptNumber }),
  );
}

try {
  if (step === "taxpayer") await taxpayer();
  else if (step === "receiptfull") await receiptLifecycle();
  else if (step === "invoice") await createInvoice();
  else if (step === "receipt") await createReceipt();
  else if (step === "getreceipt") await getReceipt();
  else if (step === "payment") await payment();
  else if (step === "proforma") await proforma();
  else if (step === "full") await full();
  else console.error("Unknown step:", step);
} catch (err) {
  if (err instanceof SzamlazzError) {
    console.error("SzamlazzError:", err.code, err.message);
    if (err.responseBody) console.error("body:", err.responseBody.slice(0, 600));
  } else {
    console.error("Error:", err);
  }
  process.exit(2);
}
