/** Thrown when the Szamla Agent reports an error or the request fails. */
export class SzamlazzError extends Error {
  /** Numeric `szlahu_error_code` header / XML error code, when present. */
  readonly code?: number;
  /** HTTP status code of the response, when the failure was transport-level. */
  readonly httpStatus?: number;
  /** Raw response body, useful for debugging unexpected failures. */
  readonly responseBody?: string;

  constructor(
    message: string,
    opts: { code?: number; httpStatus?: number; responseBody?: string } = {},
  ) {
    super(message);
    this.name = "SzamlazzError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.responseBody = opts.responseBody;
  }
}
