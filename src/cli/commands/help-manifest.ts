import type { ParsedArgs } from '../lib/types';
import { WORK_EFFORT_ESTIMATES } from '../../shared/task-effort';
import { parseEnvironment, UnknownFlagsError } from '../lib/args';
import { failArgs } from '../lib/errors';
import { COMMAND_REGISTRY, type RegistryLeaf, type RegistryOptionRef } from './command-registry';

const CLI_VERSION = '__USERTOLD_CLI_VERSION__';


export type CommandSurface = {
  version: string;
  usage: string;
  description: string;
  globalOptions: CliOption[];
  commands: CliCommand[];
};

export type CliCommand = CliGroupCommand | CliFlatCommand;

export type CliGroupCommand = {
  kind: 'group';
  name: string;
  description: string;
  subcommands: Record<string, CliSubcommand>;
  deprecated?: boolean;
  aliases?: string[];
};

export type CliFlatCommand = {
  kind: 'command';
  name: string;
  description: string;
  usage: string;
  positionals: CliPositional[];
  options: CliOption[];
  examples: string[];
  operation: 'read' | 'write' | 'delete';
  auth: 'required' | 'optional' | 'none';
  dryRunSupported: boolean;
  deprecated?: boolean;
  aliases?: string[];
};

export type CliSubcommand = {
  description: string;
  usage: string;
  positionals: CliPositional[];
  options: CliOption[];
  examples: string[];
  operation: 'read' | 'write' | 'delete';
  auth: 'required' | 'optional' | 'none';
  pagination?: { style: 'limit_offset'; parameters: ['limit', 'offset'] };
  destructive?: boolean;
  dryRunSupported?: boolean;
  aliases?: string[];
};

export type CliOption = {
  name: string;
  aliases?: string[];
  type: 'boolean' | 'string' | 'integer' | 'number' | 'enum' | 'json';
  values?: string[];
  default?: string | number | boolean;
  description: string;
  required?: boolean;
};

export type CliPositional = {
  name: string;
  required: boolean;
  description: string;
};

type OptionMetadata = Omit<CliOption, 'name' | 'required'>;

const OPTION_CATALOG: Record<string, OptionMetadata> = {
  "activate": { description: "Activate the created resource.", type: 'boolean' },
  "all": { description: "Include all records, including dismissed records where applicable.", type: 'boolean' },
  "allowed-origins": { description: "Comma-separated list of allowed widget origins.", type: 'string' },
  "audio": { description: "Path to a local audio recording file.", type: 'string' },
  "audio-content-type": { description: "MIME type for the separate audio upload.", type: 'string' },
  "branch": { description: "Default Git branch.", type: 'string' },
  "brand-color": { description: "Brand color hex value.", type: 'string' },
  "consent-text": { description: "Consent checkbox text shown to participants.", type: 'string' },
  "content-type": { description: "MIME type for a local upload.", type: 'string' },
  "cents": { description: "Prepaid balance amount in cents.", type: 'integer' },
  "data": { description: "Request body as JSON or @file.", type: 'json' },
  "description": { description: "Description text.", type: 'string' },
  "dismissed": { description: "Show only dismissed records.", type: 'boolean' },
  "disqualified-message": { description: "Message shown to disqualified participants.", type: 'string' },
  "dry-run": { description: "Preview a command without executing it.", type: 'boolean' },
  "effort": { description: "Effort estimate: xs, s, m, l, or xl.", type: 'enum', values: [...WORK_EFFORT_ESTIMATES] },
  "email": { description: "Participant or recipient email address.", type: 'string' },
  "env": { description: "Select the UserTold environment.", type: 'enum', values: ["production","stage","local"], default: "production" },
  "events": { description: "Path to a session events file for added context.", type: 'string' },
  "external": { description: "Include reconciliation against the external billing provider.", type: 'boolean' },
  "evidence": { description: "Comma-separated evidence IDs.", type: 'string' },
  "format": { description: "Output format. Use \"json\" for structured output.", type: 'enum', values: ["json"] },
  "goals": { description: "Study goals JSON or @file.", type: 'json' },
  "grant-id": { description: "Idempotency key for the credit grant.", type: 'string' },
  "handle": { description: "URL-friendly handle.", type: 'string' },
  "header": { description: "HTTP header in key:value form (repeatable).", type: 'string' },
  "help": { description: "Show help for the selected command.", type: 'boolean', aliases: ["h"] },
  "intake": { description: "Intake handle to attach to the study.", type: 'string' },
  "interval": { description: "Polling interval in seconds.", type: 'integer' },
  "interview": { description: "Interview ID filter.", type: 'string' },
  "json": { description: "Output structured JSON.", type: 'boolean' },
  "key": { description: "Configuration key, API key, or project key.", type: 'string' },
  "limit": { description: "Maximum number of results to return.", type: 'integer' },
  "local": { description: "Shortcut for --env local.", type: 'boolean' },
  "max-participants": { description: "Maximum number of participants.", type: 'integer' },
  "min-confidence": { description: "Minimum evidence confidence (0-1).", type: 'number' },
  "min-priority": { description: "Minimum work item priority.", type: 'integer' },
  "mode": { description: "Interview mode.", type: 'string' },
  "name": { description: "Name.", type: 'string' },
  "no-auth": { description: "Do not inject a bearer token.", type: 'boolean' },
  "no-browser": { description: "Print the login URL instead of opening a browser.", type: 'boolean' },
  "no-validate": { description: "Accepted for compatibility; config writes do not run live validation.", type: 'boolean' },
  "no-verify": { description: "Skip server-side token verification.", type: 'boolean' },
  "offset": { description: "Number of results to skip.", type: 'integer' },
  "openai-key": { description: "OpenAI API key for commands that accept an explicit provider key.", type: 'string' },
  "org": { description: "Organization handle.", type: 'string' },
  "output": { description: "Output file path.", type: 'string' },
  "page-url": { description: "Example value for the {{page_url}} variable.", type: 'string' },
  "port": { description: "Local OAuth callback port.", type: 'integer' },
  "priority": { description: "Priority value.", type: 'integer' },
  "processing-status": { description: "Filter by processing status.", type: 'enum', values: ["failed","done"] },
  "provider": { description: "Delivery provider.", type: 'enum', values: ["auto","github","linear"] },
  "query": { description: "Example question for a knowledge action test.", type: 'string' },
  "questions": { description: "Questions JSON or @file.", type: 'json' },
  "raw": { description: "Print raw output.", type: 'boolean' },
  "reason": { description: "Reason text.", type: 'string' },
  "repo": { description: "GitHub repository URL.", type: 'string' },
  "script": { description: "Study script JSON or @file.", type: 'json' },
  "search": { description: "Search text.", type: 'string' },
  "session": { description: "Interview session ID.", type: 'string' },
  "section": { description: "Guide section.", type: 'string' },
  "site-hostname": { description: "Example value for the {{site_hostname}} variable.", type: 'string' },
  "status": { description: "Status filter or value.", type: 'string' },
  "study": { description: "Study handle.", type: 'string' },
  "study-context": { description: "Study context JSON or @file for extraction.", type: 'json' },
  "invitation": { description: "Canonical Study Invitation JSON or @file. direct_link provisions a revocable recruitment_url; null/omitted uses the built-in launcher.", type: 'json' },
  "language": { description: "Normalized widget language for placement preview. Defaults to en.", type: 'string' },
  "path": { description: "HTTP pathname for placement preview, for example /docs/setup.", type: 'string' },
  "visibility": { description: "Study Visibility v1 JSON or @file. null/omitted inherits enabled placement on all pages and supported languages; enabled:false opts out.", type: 'json' },
  "study-title": { description: "Title for the bootstrapped study.", type: 'string' },
  "summary": { description: "Summary text.", type: 'string' },
  "target-surface": { description: "Area filter.", type: 'enum', values: ["product_under_test","usertold_widget_interview","interviewer_conductor_behavior","ambiguous_needs_review","all"] },
  "text": { description: "Annotation text.", type: 'string' },
  "thank-you-message": { description: "Message shown after a completed intake.", type: 'string' },
  "timeline": { description: "Path to a session timeline file for added context.", type: 'string' },
  "timeout": { description: "Timeout in seconds.", type: 'integer' },
  "title": { description: "Title.", type: 'string' },
  "token": { description: "Access token.", type: 'string' },
  "type": { description: "Type filter or value.", type: 'string' },
  "url": { description: "Exact public HTTPS page for the widget installation preflight.", type: 'string' },
  "value": { description: "Configuration value.", type: 'string' },
  "verbose": { description: "Print verbose progress output.", type: 'boolean' },
  "video": { description: "Path to a local video recording paired with --audio.", type: 'string' },
  "video-content-type": { description: "MIME type for the separate video upload.", type: 'string' },
  "wait": { description: "Wait for background processing to finish.", type: 'boolean' },
  "welcome-message": { description: "Welcome message shown to participants.", type: 'string' },
  "work": { description: "Work item ID filter.", type: 'string' },
  "yes": { description: "Skip prompts and run non-interactively.", type: 'boolean' },
};

const GLOBAL_OPTION_NAMES = ['env', 'json', 'format', 'local', 'dry-run', 'help'] as const;
const GLOBAL_OPTIONS: CliOption[] = GLOBAL_OPTION_NAMES.map(name => ({
  name,
  ...OPTION_CATALOG[name],
}));

function flagsToOptions(
  flags: RegistryOptionRef[],
  requiredFlags: string[] = [],
): CliOption[] {
  return flags.map((reference) => {
    const name = typeof reference === 'string' ? reference : reference.name;
    const override = typeof reference === 'string' ? {} : reference;
    const metadata = OPTION_CATALOG[name];
    if (!metadata) throw new Error(`Missing option metadata for --${name}`);
    return {
      name,
      ...metadata,
      required: requiredFlags.includes(name) || undefined,
      ...override,
    };
  });
}

function commandUsage(group: string, subcommand: string, positionals: CliPositional[]): string {
  const positionalText = positionals
    .map(positional => (positional.required ? `<${positional.name}>` : `[<${positional.name}>]`))
    .join(' ');
  return ['usertold', group, subcommand, positionalText, '[options]'].filter(Boolean).join(' ');
}

export function buildCommandSurface(): CommandSurface {
  const commands: CliCommand[] = Object.entries(COMMAND_REGISTRY).map(([name, command]) => {
    if (command.kind === 'command') {
      return {
        kind: 'command',
        name,
        description: command.summary,
        usage: command.usage ?? `usertold ${name} [options]`,
        positionals: command.positionals,
        options: flagsToOptions(command.options, command.requiredOptions),
        examples: command.examples,
        operation: command.operation,
        auth: command.auth,
        dryRunSupported: true,
      };
    }

    return {
      kind: 'group',
      name,
      description: command.summary,
      deprecated: false,
      subcommands: Object.fromEntries(Object.entries(command.subcommands).map(([subcommandName, subcommand]) => [
        subcommandName,
        buildRegisteredSubcommand(name, subcommandName, subcommand),
      ])),
    };
  });

  return {
    version: CLI_VERSION,
    usage: 'usertold <group> <subcommand> [options]',
    description: 'UserTold CLI for agentic user research workflows.',
    globalOptions: GLOBAL_OPTIONS,
    commands,
  };
}

function buildRegisteredSubcommand(group: string, name: string, subcommand: RegistryLeaf): CliSubcommand {
  return {
    description: subcommand.summary,
    usage: commandUsage(group, name, subcommand.positionals),
    positionals: subcommand.positionals,
    options: flagsToOptions(subcommand.options, subcommand.requiredOptions),
    examples: subcommand.examples,
    operation: subcommand.operation,
    auth: subcommand.auth,
    pagination: subcommand.pagination,
    destructive: subcommand.destructive ?? false,
    dryRunSupported: true,
  };
}

export function findCommandLeaf(commandName: string, subcommandName?: string): CliFlatCommand | CliSubcommand | null {
  const command = findCommand(commandName);
  if (!command) return null;
  if (command.kind === 'command') return command;
  return subcommandName ? command.subcommands[subcommandName] ?? null : null;
}

export function findCommand(name: string): CliCommand | null {
  return buildCommandSurface().commands.find((command) => command.name === name) ?? null;
}

export function buildHelpPayload(commandName?: string, subcommandName?: string): CommandSurface | CliCommand | CliSubcommand {
  if (!commandName) return buildCommandSurface();

  const command = findCommand(commandName);
  if (!command) return buildCommandSurface();

  if (!subcommandName || command.kind === 'command') return command;

  return command.subcommands[subcommandName] ?? command;
}

export function commandOptionNames(commandName: string, subcommandName?: string): string[] {
  const command = findCommand(commandName);
  if (!command) return [];
  const options = command.kind === 'command'
    ? command.options
    : subcommandName ? command.subcommands[subcommandName]?.options ?? [] : [];
  return options.flatMap(option => [option.name, ...(option.aliases ?? [])]);
}

export function validateCommandInput(commandName: string, subcommandName: string | undefined, parsed: ParsedArgs): void {
  const command = findCommand(commandName);
  if (!command) return;
  const definition = command.kind === 'command'
    ? command
    : subcommandName ? command.subcommands[subcommandName] : undefined;
  if (!definition) return;

  const globalNames = GLOBAL_OPTIONS.flatMap(option => [option.name, ...(option.aliases ?? [])]);
  const localNames = definition.options.flatMap(option => [option.name, ...(option.aliases ?? [])]);
  const allowed = new Set([...globalNames, ...localNames]);
  const unknown = Object.keys(parsed.options).filter(name => !allowed.has(name));
  if (unknown.length > 0) throw new UnknownFlagsError(unknown);

  for (const option of definition.options) {
    if (!option.required || (commandName === 'init' && option.name === 'name')) continue;
    const values = [option.name, ...(option.aliases ?? [])].map(name => parsed.options[name]);
    if (!values.some(value => value && value !== 'true')) {
      failArgs(`Missing required option: --${option.name}`);
    }
  }

  const requiredPositionals = definition.positionals.filter(positional => positional.required).length;
  if (parsed.positionals.length < requiredPositionals) {
    const missing = definition.positionals.find((positional, index) => positional.required && !parsed.positionals[index]);
    failArgs(`Missing required argument: ${missing?.name ?? 'argument'}`);
  }

  for (const option of definition.options.filter(option => option.type === 'enum')) {
    const names = [option.name, ...(option.aliases ?? [])];
    const values = names.flatMap(name => parsed.multiOptions[name] ?? []);
    for (const value of values) {
      if (!option.values?.includes(value)) {
        failArgs(`Invalid value "${value}" for --${option.name}. Expected one of: ${option.values?.join(', ')}`);
      }
    }
  }
}

const DRY_RUN_REQUIRED_OPTION_GROUPS: Record<string, string[]> = {
  'project update': ['name', 'handle', 'description'],
  'interview update': ['status', 'summary'],
  'work update': ['title', 'description', 'status', 'effort', 'priority'],
  'intake update': [
    'title', 'description', 'status', 'welcome-message', 'thank-you-message',
    'disqualified-message', 'brand-color', 'consent-text', 'max-participants',
  ],
  'study update': [
    'title', 'handle', 'description', 'status', 'goals', 'script',
    'invitation', 'visibility', 'intake', 'allowed-origins',
  ],
};

export function validateDryRunInput(commandName: string, subcommandName: string | undefined, parsed: ParsedArgs): void {
  const definition = findCommandLeaf(commandName, subcommandName);
  if (!definition) return;

  for (const option of [...GLOBAL_OPTIONS, ...definition.options]) {
    if (option.name === 'env') {
      parseEnvironment(parsed);
      continue;
    }
    const names = [option.name, ...(option.aliases ?? [])];
    const values = names.flatMap(name => parsed.multiOptions[name] ?? []);
    for (const value of values) {
      if (option.type === 'enum' && !option.values?.includes(value)) {
        failArgs(`Invalid value "${value}" for --${option.name}. Expected one of: ${option.values?.join(', ')}`);
      }
      if (option.type === 'integer' && !/^-?\d+$/.test(value)) {
        failArgs(`Invalid integer "${value}" for --${option.name}.`);
      }
      if (option.type === 'number' && !Number.isFinite(Number(value))) {
        failArgs(`Invalid number "${value}" for --${option.name}.`);
      }
      if (option.type !== 'boolean' && value === 'true') {
        failArgs(`Missing value for --${option.name}.`);
      }
    }
  }

  const commandPath = [commandName, subcommandName].filter(Boolean).join(' ');
  if (commandPath === 'interview upload-video' && parsed.options.video && !parsed.options.audio) {
    failArgs('--video is only supported together with --audio. For a single video upload, pass the video path as <file>.');
  }
  const requiredGroup = DRY_RUN_REQUIRED_OPTION_GROUPS[commandPath];
  if (requiredGroup && !requiredGroup.some(name => parsed.options[name] !== undefined)) {
    failArgs(`No update fields provided. Use ${requiredGroup.map(name => `--${name}`).join(', ')}.`);
  }

  if (parsed.positionals.length > definition.positionals.length) {
    failArgs(`Unexpected extra arguments: ${parsed.positionals.slice(definition.positionals.length).join(' ')}`);
  }
}

const COMMAND_NOTES: Record<string, string> = {
  knowledge: `knowledge apply accepts a JSON object with name, when_to_use, method, url, headers, optional body, and optional response_path.
URL and JSON string values may use {{query}}, {{page_url}}, and {{site_hostname}}.`,
  export: 'Export media manifests contain signed download URLs that expire after 7 days.',
  init: `Runs interactively in a TTY. Pass --yes to accept defaults in automation.
UserTold's platform key runs first interviews when no project key is set.`,
};

export function renderRootHelp(): string {
  const surface = buildCommandSurface();
  const commandLines = surface.commands.map((command) => {
    const detail = command.kind === 'group'
      ? Object.keys(command.subcommands).join(', ')
      : command.description;
    return `  ${command.name.padEnd(18)}${detail}`;
  });
  return `${surface.description}

Usage: ${surface.usage}

Groups:
${commandLines.join('\n')}

Global options:
${formatOptionList(surface.globalOptions)}

Exit codes:
  0  success
  1  general error
  2  invalid arguments
  3  authentication required
  4  resource not found

Machine-readable: usertold --help --json`;
}

export function renderCommandHelp(commandName: string, subcommandName?: string): string {
  const command = findCommand(commandName);
  if (!command) return renderRootHelp();

  if (command.kind === 'command') {
    return renderLeafHelp(command.description, command.usage, command.positionals, command.options, command.examples, COMMAND_NOTES[command.name]);
  }

  if (subcommandName) {
    const subcommand = command.subcommands[subcommandName];
    if (!subcommand) return renderGroupHelp(command);
    return renderLeafHelp(subcommand.description, subcommand.usage, subcommand.positionals, subcommand.options, subcommand.examples);
  }

  return renderGroupHelp(command);
}

export function printCommandHelp(commandName: string, subcommandName?: string): void {
  console.log(renderCommandHelp(commandName, subcommandName));
}

function renderGroupHelp(command: CliGroupCommand): string {
  const prefix = `usertold ${command.name} `;
  const lines = Object.values(command.subcommands).map((subcommand) => {
    const usage = subcommand.usage.startsWith(prefix) ? subcommand.usage.slice(prefix.length) : subcommand.usage;
    return `  ${usage}\n    ${subcommand.description}`;
  });
  const note = COMMAND_NOTES[command.name] ? `\n\n${COMMAND_NOTES[command.name]}` : '';
  return `${command.description}

Usage: usertold ${command.name} <command> [options]

Commands:
${lines.join('\n')}${note}

Global options:
${formatOptionList(GLOBAL_OPTIONS)}`;
}

function renderLeafHelp(
  description: string,
  usage: string,
  positionals: CliPositional[],
  options: CliOption[],
  examples: string[],
  note?: string,
): string {
  const argumentsSection = positionals.length > 0
    ? `\n\nArguments:\n${positionals.map(positional => `  ${positional.name.padEnd(24)}${positional.description}${positional.required ? ' (required)' : ''}`).join('\n')}`
    : '';
  const optionList = uniqueOptions([...options, ...GLOBAL_OPTIONS]);
  const optionsSection = optionList.length > 0 ? `\n\nOptions:\n${formatOptionList(optionList)}` : '';
  const noteSection = note ? `\n\n${note}` : '';
  const examplesSection = examples.length > 0 ? `\n\nExamples:\n${examples.map(example => `  ${example}`).join('\n')}` : '';
  return `Usage:\n  ${usage}\n\n${description}${argumentsSection}${optionsSection}${noteSection}${examplesSection}`;
}

function formatOptionList(options: CliOption[]): string {
  return options.map((option) => {
    const alias = option.aliases?.map(value => `-${value}`).join(', ');
    const name = [alias, `--${option.name}`].filter(Boolean).join(', ');
    const value = option.type === 'boolean'
      ? ''
      : option.values?.length ? ` <${option.values.join('|')}>` : ` <${option.type === 'integer' || option.type === 'number' ? 'number' : 'value'}>`;
    return `  ${(name + value).padEnd(34)}${option.description}${option.required ? ' (required)' : ''}`;
  }).join('\n');
}

function uniqueOptions(options: CliOption[]): CliOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.name)) return false;
    seen.add(option.name);
    return true;
  });
}
