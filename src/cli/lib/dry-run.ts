import { AsyncLocalStorage } from 'node:async_hooks';

const dryRunStorage = new AsyncLocalStorage<boolean>();

export function runWithDryRunProtection<T>(enabled: boolean, operation: () => Promise<T>): Promise<T> {
  return dryRunStorage.run(enabled, operation);
}

export function assertSideEffectAllowed(description: string): void {
  if (dryRunStorage.getStore() === true) {
    throw new Error(`Dry-run safety contract blocked side effect: ${description}`);
  }
}
