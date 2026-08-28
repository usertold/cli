export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
export const EXIT_ARGS = 2;
export const EXIT_AUTH = 3;
export const EXIT_NOT_FOUND = 4;

export class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = EXIT_ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function fail(message: string, exitCode = EXIT_ERROR): never {
  throw new CliError(message, exitCode);
}

export function failArgs(message: string): never {
  throw new CliError(message, EXIT_ARGS);
}

export function failAuth(message: string): never {
  throw new CliError(message, EXIT_AUTH);
}

export function failNotFound(message: string): never {
  throw new CliError(message, EXIT_NOT_FOUND);
}
