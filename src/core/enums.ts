/** Invoice / receipt language (`szamlaNyelve`). */
export enum Language {
  Hungarian = "hu",
  English = "en",
  German = "de",
  Italian = "it",
  Romanian = "ro",
  Slovak = "sk",
  Croatian = "hr",
  French = "fr",
  Spanish = "es",
  Czech = "cz",
  Polish = "pl",
}

/** Common currency codes (`penznem`). Any ISO 4217 string is also accepted. */
export enum Currency {
  Ft = "Ft",
  HUF = "HUF",
  EUR = "EUR",
  USD = "USD",
  GBP = "GBP",
  CHF = "CHF",
  PLN = "PLN",
  RON = "RON",
  CZK = "CZK",
}

/**
 * Payment methods (`fizmod`). The Agent accepts free-text values, so this is a
 * convenience list of the canonical Hungarian labels Szamlazz.hu recognises.
 */
export enum PaymentMethod {
  Cash = "készpénz",
  BankTransfer = "átutalás",
  BankCard = "bankkártya",
  CashOnDelivery = "utánvét",
  CreditCard = "hitelkártya",
  Voucher = "utalvány",
  PayPal = "PayPal",
  Barion = "Barion",
  Stripe = "Stripe",
  SimplePay = "SimplePay",
  Compensation = "kompenzáció",
  Other = "egyéb",
}
