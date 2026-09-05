#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from './lib/args';
import { CliError, EXIT_ARGS, EXIT_AUTH, EXIT_NOT_FOUND } from './lib/errors';
import { handleAuthCommand } from './commands/auth';
import { handleProjectCommand } from './commands/project';
import { handleSessionCommand } from './commands/session';
import { handleSignalCommand } from './commands/signal';
import { handleFindingCommand } from './commands/task';
import { handleScreenerCommand } from './commands/screener';
import { handleStudyCommand } from './commands/study';
import { handleBillingCommand } from './commands/billing';
import { handleDataExportCommand } from './commands/data-export';
import { handleKnowledgeCommand } from './commands/config';
import { handleOrganizationCommand } from './commands/organization';
import { handleSettingsCommand } from './commands/settings';
import { handleIntegrationCommand } from './commands/integration';
import { handleInitCommand } from './commands/init';
import { buildHelpPayload, findCommand, findCommandLeaf, renderCommandHelp, renderRootHelp, validateCommandInput, validateDryRunInput } from './commands/help-manifest';
import { handleCompletionsCommand } from './commands/completions';
import { printDryRunPlan } from './commands/dry-run';
import { runWithDryRunProtection } from './lib/dry-run';
import { CLI_VERSION } from './lib/version';

function detectJsonMode(): boolean {
  const argv = process.argv.slice(2);
  if (argv.includes('--json')) return true;
  const fmtIdx = argv.indexOf('--format');
  if (fmtIdx !== -1 && argv[fmtIdx + 1] === 'json') return true;
  return false;
}

function errorCode(error: CliError): string {
  switch (error.exitCode) {
    case EXIT_ARGS:      return 'ARGS_ERROR';
    case EXIT_AUTH:      return 'AUTH_ERROR';
    case EXIT_NOT_FOUND: return 'NOT_FOUND';
    default:             return 'ERROR';
  }
}

function errorPayload(error: CliError): { error: Record<string, unknown> } {
  const payload: Record<string, unknown> = {
    code: errorCode(error),
    message: error.message,
    exitCode: error.exitCode,
    hint: 'Run "usertold --help" or "usertold --help --json" for available commands.',
  };

  const unknownRoot = /^Unknown command: (.+)$/.exec(error.message);
  if (unknownRoot) {
    const surface = buildHelpPayload();
    if ('commands' in surface) {
      payload.validCommands = surface.commands.map(command => command.name);
    }
  }

  const unknownSubcommand = /^Unknown ([a-z-]+) command: (.+)$/.exec(error.message);
  if (unknownSubcommand) {
    const commandName = unknownSubcommand[1];
    payload.hint = `Run "usertold ${commandName} --help" or "usertold ${commandName} --help --json" for available subcommands.`;
    const command = buildHelpPayload(commandName);
    if ('kind' in command && command.kind === 'group') {
      payload.validCommands = Object.keys(command.subcommands);
    }
  }

  return { error: payload };
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (command === '--version' || command === '-v') {
    console.log(CLI_VERSION);
    return;
  }

  if (!command || command === '--help' || command === '-h') {
    if (detectJsonMode()) {
      printJsonHelp();
      return;
    }
    printRootHelp();
    return;
  }

  try {
    await runWithDryRunProtection(
      parseArgs(rest).options['dry-run'] === 'true',
      () => dispatch(command, rest),
    );
  } catch (error) {
    const jsonMode = detectJsonMode();

    if (error instanceof CliError) {
      if (jsonMode) {
        process.stderr.write(JSON.stringify(errorPayload(error)) + '\n');
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exitCode = error.exitCode;
      return;
    }

    if (error instanceof Error) {
      if (jsonMode) {
        process.stderr.write(JSON.stringify({ error: { code: 'ERROR', message: error.message, exitCode: 1 } }) + '\n');
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exitCode = 1;
      return;
    }

    if (jsonMode) {
      process.stderr.write(JSON.stringify({ error: { code: 'ERROR', message: 'Unexpected failure', exitCode: 1 } }) + '\n');
    } else {
      console.error('Error: Unexpected failure');
    }
    process.exitCode = 1;
  }
}

async function dispatch(command: string, argv: string[]): Promise<void> {
  if (isJsonHelpRequest([command, ...argv])) {
    const helpPath = extractHelpPath([command, ...argv]);
    printJsonHelp(helpPath[0], helpPath[1]);
    return;
  }
  if (isSubcommandTextHelpRequest([command, ...argv])) {
    const helpPath = extractHelpPath([command, ...argv]);
    printSubcommandHelp(helpPath[0], helpPath[1]);
    return;
  }

  const registeredCommand = findCommand(command);
  if (registeredCommand) {
    const parsed = parseArgs(registeredCommand.kind === 'group' ? argv.slice(1) : argv);
    const hasHelpFlag = parsed.options.help === 'true' || parsed.options.h === 'true';
    if (registeredCommand.kind === 'command' && (hasHelpFlag || argv[0] === 'help')) {
      console.log(renderCommandHelp(command));
      return;
    }
    const subcommand = registeredCommand.kind === 'group' ? argv[0] : undefined;
    validateCommandInput(command, subcommand, parsed);

    const definition = findCommandLeaf(command, subcommand);
    if (definition?.dryRunSupported && parsed.options['dry-run'] === 'true') {
      validateDryRunInput(command, subcommand, parsed);
      await printDryRunPlan(command, subcommand, definition, parsed);
      return;
    }
  }

  switch (command) {
    case 'auth': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleAuthCommand(subcommand, parsed);
      return;
    }

    case 'project': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleProjectCommand(subcommand, parsed);
      return;
    }

    case 'interview': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleSessionCommand(subcommand, parsed);
      return;
    }

    case 'evidence': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleSignalCommand(subcommand, parsed);
      return;
    }

    case 'findings': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleFindingCommand(subcommand, parsed);
      return;
    }

    case 'intake': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleScreenerCommand(subcommand, parsed);
      return;
    }

    case 'study': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleStudyCommand(subcommand, parsed);
      return;
    }

    case 'billing': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleBillingCommand(subcommand, parsed);
      return;
    }

    case 'export': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleDataExportCommand(subcommand, parsed);
      return;
    }

    case 'knowledge': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleKnowledgeCommand(subcommand, parsed);
      return;
    }

    case 'organization': {
      const [subcommand, ...rest] = argv;
      await handleOrganizationCommand(subcommand, parseArgs(rest));
      return;
    }

    case 'settings': {
      const [subcommand, ...rest] = argv;
      await handleSettingsCommand(subcommand, parseArgs(rest));
      return;
    }

    case 'integration': {
      const [subcommand, ...rest] = argv;
      await handleIntegrationCommand(subcommand, parseArgs(rest));
      return;
    }

    case 'init': {
      const parsed = parseArgs(argv);
      await handleInitCommand(parsed);
      return;
    }

    case 'completions': {
      const [subcommand, ...rest] = argv;
      const parsed = parseArgs(rest);
      await handleCompletionsCommand(subcommand, parsed);
      return;
    }

    case 'help': {
      printRootHelp();
      return;
    }

    default:
      // In JSON mode the only thing on stdout must be machine-parseable; the
      // error itself is emitted as JSON on stderr by the top-level handler.
      if (!detectJsonMode()) printRootHelp();
      throw new CliError(`Unknown command: ${command}`);
  }
}

export const ROOT_HELP = renderRootHelp();

function printRootHelp() {
  console.log(renderRootHelp());
}

function isJsonHelpRequest(argv: string[]): boolean {
  return argv.some((token, index) => token === '--help' || token === '-h' || (index <= 1 && token === 'help')) && (
    argv.includes('--json') || argv.some((token, index) => token === '--format' && argv[index + 1] === 'json')
  );
}

function extractHelpPath(argv: string[]): string[] {
  const path: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h' || (index <= 1 && token === 'help') || token === '--json') continue;
    if (token === '--format') {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) continue;
    path.push(token);
  }
  return path.slice(0, 2);
}

function printJsonHelp(commandName?: string, subcommandName?: string): void {
  if (commandName) {
    const command = findCommand(commandName);
    if (!command) {
      throw new CliError(`Unknown command: ${commandName}`);
    }
    if (subcommandName && command.kind === 'group' && !command.subcommands[subcommandName]) {
      throw new CliError(`Unknown ${commandName} command: ${subcommandName}`);
    }
  }
  console.log(JSON.stringify(buildHelpPayload(commandName, subcommandName)));
}

function isSubcommandTextHelpRequest(argv: string[]): boolean {
  if (!argv.some((token, index) => token === '--help' || token === '-h' || (index <= 1 && token === 'help'))) return false;
  if (isJsonHelpRequest(argv)) return false;

  const helpPath = extractHelpPath(argv);
  return helpPath.length >= 2;
}

function printSubcommandHelp(commandName?: string, subcommandName?: string): void {
  if (!commandName || !subcommandName) {
    printRootHelp();
    return;
  }

  const command = findCommand(commandName);
  if (!command) {
    throw new CliError(`Unknown command: ${commandName}`);
  }
  if (command.kind === 'group' && !command.subcommands[subcommandName]) {
    throw new CliError(`Unknown ${commandName} command: ${subcommandName}`);
  }
  console.log(renderCommandHelp(commandName, subcommandName));
}

void main();

export {
  printRootHelp,
};
