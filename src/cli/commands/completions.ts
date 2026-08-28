import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag } from '../lib/args';
import { failArgs } from '../lib/errors';
import { buildCommandSurface, printCommandHelp, type CommandSurface } from './help-manifest';

const SHELLS = ['bash', 'zsh', 'fish'] as const;

export async function handleCompletionsCommand(shell: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!shell || hasHelpFlag(parsed) || shell === '--help' || shell === '-h' || shell === 'help') {
    printCommandHelp('completions');
    return;
  }

  if (!SHELLS.includes(shell as typeof SHELLS[number])) {
    failArgs(`Unknown shell: ${shell}. Supported: ${SHELLS.join(', ')}`);
  }

  const surface = buildCommandSurface();

  switch (shell) {
    case 'bash':  console.log(generateBashCompletions(surface)); break;
    case 'zsh':   console.log(generateZshCompletions(surface)); break;
    case 'fish':  console.log(generateFishCompletions(surface)); break;
  }
}

export function generateBashCompletions(surface: CommandSurface): string {
  const commands = surface.commands.filter(command => !command.deprecated);
  const commandNames = commands.map(c => c.name).join(' ');
  const globalFlags = surface.globalOptions.flatMap(option => optionNames(option.name, option.aliases)).join(' ');

  const cases: string[] = [];
  for (const cmd of commands) {
    if (cmd.kind !== 'group') continue;
    const subs = Object.keys(cmd.subcommands);
    if (subs.length === 0) continue;

    const subLines: string[] = [];
    for (const [sub, def] of Object.entries(cmd.subcommands)) {
      const flags = [...def.options.flatMap(option => optionNames(option.name, option.aliases)), ...globalFlags.split(' ')].join(' ');
      subLines.push(`        ${sub}) COMPREPLY=($(compgen -W "${flags}" -- "$cur")) ;;`);
    }

    cases.push(`    ${cmd.name})
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=($(compgen -W "${subs.join(' ')} ${globalFlags}" -- "$cur"))
        return
      fi
      case "\${words[2]}" in
${subLines.join('\n')}
      esac
      ;;`);
  }

  // Commands with no subcommands get global flags at level 2
  for (const cmd of commands) {
    if (cmd.kind === 'group' && Object.keys(cmd.subcommands).length > 0) continue;
    const flags = cmd.kind === 'command'
      ? [...cmd.options.flatMap(option => optionNames(option.name, option.aliases)), ...globalFlags.split(' ')].join(' ')
      : globalFlags;
    cases.push(`    ${cmd.name})
      COMPREPLY=($(compgen -W "${flags}" -- "$cur"))
      ;;`);
  }

  return `# bash completion for usertold
# Install: usertold completions bash >> ~/.bashrc
#    or:   usertold completions bash > /etc/bash_completion.d/usertold

_usertold_completions() {
  local cur prev words cword
  _init_completion || return

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${commandNames} --version --help" -- "$cur"))
    return
  fi

  case "\${words[1]}" in
${cases.join('\n')}
  esac
}

complete -F _usertold_completions usertold`;
}

export function generateZshCompletions(surface: CommandSurface): string {
  const commands = surface.commands.filter(command => !command.deprecated);
  const globalFlags = surface.globalOptions.flatMap(option => optionNames(option.name, option.aliases));
  const commandDescs = commands
    .map(cmd => {
      const subs = cmd.kind === 'group' ? Object.keys(cmd.subcommands).join(', ') : cmd.description;
      return `    '${cmd.name}:${subs || cmd.description}'`;
    })
    .join('\n');

  const subCases: string[] = [];
  for (const cmd of commands) {
    if (cmd.kind !== 'group') continue;
    const subs = Object.keys(cmd.subcommands);
    if (subs.length === 0) continue;

    const subDescs = subs.map(s => `'${s}'`).join(' ');
    subCases.push(`      ${cmd.name}) subcommands=(${subDescs}); _describe 'subcommand' subcommands ;;`);
  }

  const flagCases: string[] = [];
  for (const cmd of commands) {
    if (cmd.kind === 'command') {
      const allFlags = [...cmd.options.flatMap(option => optionNames(option.name, option.aliases)), ...globalFlags].map(f => `'${f}'`).join(' ');
      flagCases.push(`      ${cmd.name}:*) flags=(${allFlags}); compadd -a flags ;;`);
      continue;
    }
    for (const [sub, def] of Object.entries(cmd.subcommands)) {
      const allFlags = [...def.options.flatMap(option => optionNames(option.name, option.aliases)), ...globalFlags].map(f => `'${f}'`).join(' ');
      flagCases.push(`      ${cmd.name}:${sub}) flags=(${allFlags}); compadd -a flags ;;`);
    }
  }

  return `#compdef usertold
# Install: usertold completions zsh > ~/.zfunc/_usertold
#    (ensure ~/.zfunc is in your fpath)

_usertold() {
  local -a commands subcommands flags

  commands=(
${commandDescs}
  )

  _arguments -C \\
    '1:command:->command' \\
    '2:subcommand:->subcommand' \\
    '*::options:->options'

  case $state in
    command)
      _describe 'command' commands
      ;;
    subcommand)
      case $words[1] in
${subCases.join('\n')}
      esac
      ;;
    options)
      case "$words[1]:$words[2]" in
${flagCases.join('\n')}
      esac
      ;;
  esac
}

compdef _usertold usertold`;
}

export function generateFishCompletions(surface: CommandSurface): string {
  const commands = surface.commands.filter(command => !command.deprecated);
  const lines: string[] = [
    '# fish completion for usertold',
    '# Install: usertold completions fish > ~/.config/fish/completions/usertold.fish',
    '',
    '# Disable file completions',
    'complete -c usertold -f',
    '',
    '# Global flags',
  ];

  for (const option of surface.globalOptions) {
    lines.push(fishOptionLine(option.name, option.description));
    for (const alias of option.aliases ?? []) {
      lines.push(`complete -c usertold -s ${alias} -d '${escapeFish(option.description)}'`);
    }
  }

  lines.push('', '# Commands');
  for (const cmd of commands) {
    const description = cmd.kind === 'group'
      ? cmd.description
      : cmd.description;
    lines.push(`complete -c usertold -n '__fish_use_subcommand' -a '${cmd.name}' -d '${escapeFish(description)}'`);
  }

  lines.push('', '# Subcommands');
  for (const cmd of commands) {
    if (cmd.kind !== 'group') continue;
    const subs = Object.keys(cmd.subcommands);
    if (subs.length === 0) continue;

    for (const sub of subs) {
      lines.push(`complete -c usertold -n '__fish_seen_subcommand_from ${cmd.name}' -a '${sub}' -d '${escapeFish(cmd.subcommands[sub].description)}'`);
    }
  }

  lines.push('', '# Subcommand flags');
  for (const cmd of commands) {
    if (cmd.kind === 'command') {
      for (const option of cmd.options) {
        const condition = `__fish_seen_subcommand_from ${cmd.name}`;
        lines.push(fishOptionLine(option.name, option.description, condition));
        for (const alias of option.aliases ?? []) {
          lines.push(fishOptionAliasLine(alias, option.description, condition));
        }
      }
      continue;
    }
    for (const [sub, def] of Object.entries(cmd.subcommands)) {
      for (const option of def.options) {
        const condition = `__fish_seen_subcommand_from ${cmd.name}; and __fish_seen_subcommand_from ${sub}`;
        lines.push(fishOptionLine(option.name, option.description, condition));
        for (const alias of option.aliases ?? []) {
          lines.push(fishOptionAliasLine(alias, option.description, condition));
        }
      }
    }
  }

  return lines.join('\n');
}

function optionNames(name: string, aliases?: string[]): string[] {
  return [`--${name}`, ...(aliases ?? []).map(alias => `-${alias}`)];
}

function fishOptionLine(name: string, description: string, condition?: string): string {
  const conditionPart = condition ? ` -n '${condition}'` : '';
  return `complete -c usertold${conditionPart} -l ${name} -d '${escapeFish(description)}'`;
}

function fishOptionAliasLine(alias: string, description: string, condition?: string): string {
  const conditionPart = condition ? ` -n '${condition}'` : '';
  return `complete -c usertold${conditionPart} -s ${alias} -d '${escapeFish(description)}'`;
}

function escapeFish(value: string): string {
  return value.replace(/'/g, "\\'");
}
