# Examples

Runnable usage examples for `szamlazz-agent`.

## Running

These import from the published package name, so install it first (in your own
project) or build this repo and link it:

```bash
npm install szamlazz-agent
# TypeScript examples run directly with tsx:
SZAMLAZZ_AGENT_KEY=your-agent-key npx tsx examples/create-invoice.ts
```

| File | What it shows |
| --- | --- |
| [create-invoice.ts](create-invoice.ts) | Create an invoice, get the PDF, save it to disk. |
| [receipt.ts](receipt.ts) | Receipt create → e-mail → query → storno. |
| [financial-data-webhook.ts](financial-data-webhook.ts) | Receive Penzugyi adatkapcsolat PUSH packages (Fetch + Node http). |

## Environment variables

- `SZAMLAZZ_AGENT_KEY` — your Szamla Agent key (token).
- `SZAMLAZZ_FDC_KEY` — the Financial Data Connection identification key
  (`X-Szamlazzhu-Key`) for the webhook example.

> Tip: Szamlazz.hu offers a demo mode for testing without issuing real
> documents. Use a demo Agent key while developing.
