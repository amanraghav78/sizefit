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
