import { CLI_VERSION } from './version';

export function buildCliUserAgent(): string {
  return `usertold-cli/${CLI_VERSION} (Node ${process.version}; ${process.platform}; ${process.arch})`;
}
