# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-28

### Added

- `SzamlazzClient` covering the full Szamla Agent API (Agent key / token auth):
  - `createInvoice` — invoice or proforma (`xmlszamla`)
  - `reverseInvoice` — storno (`xmlszamlast`)
  - `registerPayment` — credit entry / payment (`xmlszamlakifiz`)
  - `getInvoicePdf` — PDF download (`xmlszamlapdf`)
  - `getInvoiceXml` — invoice as XML (`xmlszamlaxml`)
  - `deleteProforma` — proforma deletion (`xmlszamladbkdel`)
  - `createReceipt`, `reverseReceipt`, `getReceipt`, `sendReceipt` — receipts
  - `queryTaxpayer` — NAV taxpayer lookup (`xmltaxpayer`)
- `FinancialDataReceiver` for the Penzugyi adatkapcsolat (Financial Data
  Connection) 5.0 PUSH interface: parses outgoing/incoming invoice, bank
  transaction, and receipt packages, verifies the `X-Szamlazzhu-Key`, and builds
  the acknowledgment XML. Framework-agnostic `handle()` plus a Fetch
  `webHandler()` adapter.
- `SzamlazzError`, and `Language` / `Currency` / `PaymentMethod` / `FdcErrorCode`
  enums.
- Dual ESM + CommonJS build with type declarations; native `fetch`, no HTTP
  dependency (Node 18+).
- Test suite (vitest) and live validation against the Szamlazz.hu demo Agent for
  every operation.

[Unreleased]: https://github.com/Klafaa/szamlazz-agent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Klafaa/szamlazz-agent/releases/tag/v0.1.0
