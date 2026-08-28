import type { ParsedArgs } from '../lib/types';
import { removeConfig } from '../lib/config';
import { parseOptionalEnvironment } from '../lib/args';

export async function handleLogout(parsed: ParsedArgs) {
  // When env is omitted, logout clears all stored credentials.
  const environment = parseOptionalEnvironment(parsed) ?? undefined;

  try {
    if (environment) {
      await removeConfig(environment);
      console.log(`Removed stored credentials for environment "${environment}".`);
    } else {
      await removeConfig(); // Remove all environments
      console.log('Removed all stored credentials.');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No stored credentials were found.');
      return;
    }
    throw error;
  }
}
