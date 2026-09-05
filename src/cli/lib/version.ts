declare const __USERTOLD_PUBLIC_CLI_VERSION__: string;

export const CLI_VERSION = typeof __USERTOLD_PUBLIC_CLI_VERSION__ === 'string'
  ? __USERTOLD_PUBLIC_CLI_VERSION__
  : '0.0.0-dev';
