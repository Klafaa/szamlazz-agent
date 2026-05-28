export { SzamlazzClient } from "./client.js";
export type { SzamlazzClientOptions } from "./client.js";

export { SzamlazzError } from "./core/errors.js";
export { Language, Currency, PaymentMethod } from "./core/enums.js";
export { DEFAULT_ENDPOINT } from "./core/transport.js";

export type {
  CreateInvoiceOptions,
  CreateInvoiceResult,
  InvoiceHeader,
  InvoiceItem,
  Seller,
  Buyer,
} from "./operations/invoice.js";
export type {
  ReverseInvoiceOptions,
  ReverseInvoiceResult,
} from "./operations/storno.js";
export type {
  RegisterPaymentOptions,
  RegisterPaymentResult,
  PaymentEntry,
} from "./operations/payment.js";
export type {
  DocumentSelector,
  InvoiceXmlResult,
} from "./operations/query.js";
export type {
  DeleteProformaOptions,
  DeleteProformaResult,
} from "./operations/proforma.js";
export type {
  CreateReceiptOptions,
  ReceiptItem,
  ReceiptPayment,
  ReceiptResult,
  ReverseReceiptResult,
  GetReceiptResult,
  SendReceiptOptions,
  SendReceiptResult,
} from "./operations/receipt.js";
export type { TaxpayerResult } from "./operations/taxpayer.js";

// Penzugyi adatkapcsolat (Financial Data Connection) — PUSH receiver
export {
  FinancialDataReceiver,
} from "./fdc/receiver.js";
export type {
  FdcHandlers,
  FinancialDataReceiverOptions,
  FdcHandleInput,
  FdcHandleResult,
} from "./fdc/receiver.js";
export { FdcErrorCode } from "./fdc/types.js";
export type {
  FdcPackage,
  FdcPackageType,
  FdcContext,
  FdcAck,
  FdcItem,
  OutgoingInvoice,
  IncomingInvoice,
  BankTransaction,
  Receipt,
} from "./fdc/types.js";
export { parsePackage, detectPackageType } from "./fdc/parse.js";
export { buildAck } from "./fdc/response.js";
