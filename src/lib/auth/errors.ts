export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "not_found" | "invalid" | "conflict" | "unavailable" | "rate_limited",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const forbidden = (msg = "You do not have access to this resource.") => new DomainError(msg, "forbidden");
export const notFound = (msg = "Not found.") => new DomainError(msg, "not_found");
export const invalid = (msg: string) => new DomainError(msg, "invalid");
export const conflict = (msg: string) => new DomainError(msg, "conflict");

export function httpStatus(err: unknown): number {
  if (err instanceof DomainError) {
    return { forbidden: 403, not_found: 404, invalid: 400, conflict: 409, unavailable: 503, rate_limited: 429 }[err.code];
  }
  return 500;
}

/** Message that is safe to show to the user. Internal errors are not leaked. */
export function publicMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  return "Something went wrong. Please try again.";
}
