const INJECTED_CLI_VERSION = '__USERTOLD_CLI_VERSION__';

export function buildCliUserAgent(): string {
  const version =
    INJECTED_CLI_VERSION === '__USERTOLD_CLI_VERSION__'
      ? '0.0.0'
      : INJECTED_CLI_VERSION;
  return `usertold-cli/${version} (Node ${process.version}; ${process.platform}; ${process.arch})`;
}
