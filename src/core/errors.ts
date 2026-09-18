export class CompressError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'CompressError';
  }
}

export class InvalidRequestError extends CompressError {
  constructor(message: string) {
    super(message, 'invalid_request');
  }
}

export class CorruptInputError extends CompressError {
  constructor(message: string) {
    super(message, 'corrupt_input');
  }
}

export class CancelledError extends CompressError {
  constructor() {
    super('Compression was cancelled', 'cancelled');
  }
}

/**
 * A password-protected PDF. Separate from `CorruptInputError` because the file
 * is perfectly fine — it just cannot be opened without a password, and telling
 * someone their bank statement is "damaged" sends them looking for a problem
 * that does not exist.
 */
export class EncryptedPdfError extends CompressError {
  constructor() {
    super('PDF is password-protected', 'encrypted_pdf');
  }
}
