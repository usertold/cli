import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './lib/args';
import {
  buildCommandSurface,
  commandOptionNames,
  renderCommandHelp,
  renderRootHelp,
  validateCommandInput,
} from './commands/help-manifest';
import { generateBashCompletions, generateFishCompletions } from './commands/completions';

test('root human help is rendered from the registered command hierarchy', () => {
  const surface = buildCommandSurface();
  const help = renderRootHelp();

  for (const command of surface.commands) {
    assert.match(help, new RegExp(`\\b${command.name}\\b`));
    if (command.kind === 'group') {
      for (const subcommand of Object.keys(command.subcommands)) {
        assert.match(help, new RegExp(`\\b${subcommand}\\b`));
      }
    }
  }
});

test('nested human and JSON help share descriptions, required inputs, and aliases', () => {
  const surface = buildCommandSurface();
  const intake = surface.commands.find(command => command.name === 'intake');
  assert.ok(intake && intake.kind === 'group');

  const create = intake.subcommands.create;
  const title = create.options.find(option => option.name === 'title');
  assert.equal(title?.required, true);
  const help = renderCommandHelp('intake', 'create');
  assert.match(help, new RegExp(create.description));
  assert.match(help, /--title <value>.*Title\..*\(required\)/);

  const init = surface.commands.find(command => command.name === 'init');
  assert.ok(init && init.kind === 'command');
  const yes = init.options.find(option => option.name === 'yes');
  assert.deepEqual(yes?.aliases, ['y']);
  assert.match(renderCommandHelp('init'), /-y, --yes/);
  assert.ok(commandOptionNames('init').includes('y'));

  const findings = surface.commands.find(command => command.name === 'findings');
  assert.ok(findings && findings.kind === 'group');
  const effort = findings.subcommands.update.options.find(option => option.name === 'effort');
  assert.deepEqual(effort?.values, ['xs', 's', 'm', 'l', 'xl']);
  assert.match(renderCommandHelp('findings', 'update'), /--effort <xs\|s\|m\|l\|xl>/);
  const findingStatus = findings.subcommands.update.options.find(option => option.name === 'status');
  assert.deepEqual(findingStatus?.values, ['backlog', 'ready', 'in_progress', 'done', 'wont_fix']);
  assert.match(findingStatus?.description ?? '', /ready.*supporting Evidence/);
  const provider = findings.subcommands.push.options.find(option => option.name === 'provider');
  assert.deepEqual(provider?.values, ['auto', 'github', 'linear']);
  assert.match(provider?.description ?? '', /dashboard-configured selection/);
  assert.equal(findings.subcommands.get.positionals.at(-1)?.name, 'findingRef');

  const study = surface.commands.find(command => command.name === 'study');
  assert.ok(study && study.kind === 'group');
  const studyStatus = study.subcommands.update.options.find(option => option.name === 'status');
  assert.deepEqual(studyStatus?.values, ['draft', 'active', 'paused', 'closed']);
  assert.match(study.subcommands['validate-script'].description, /existing Study/);
  assert.match(
    study.subcommands.create.options.find(option => option.name === 'activate')?.description ?? '',
    /begin matching eligible participants/,
  );

  const knowledge = surface.commands.find(command => command.name === 'knowledge');
  assert.ok(knowledge && knowledge.kind === 'group');
  assert.ok(knowledge.subcommands.apply.options.some(option => option.name === 'data' && option.required));

  const settings = surface.commands.find(command => command.name === 'settings');
  assert.ok(settings && settings.kind === 'group');
  assert.deepEqual(
    settings.subcommands.set.options.find(option => option.name === 'key')?.values,
    ['openai_api_key', 'retention_days'],
  );

  const auth = surface.commands.find(command => command.name === 'auth');
  assert.ok(auth && auth.kind === 'group');
  assert.deepEqual(
    auth.subcommands['browser-session'].options.find(option => option.name === 'format')?.values,
    ['storage', 'env', 'cookie', 'jwt'],
  );

  const interview = surface.commands.find(command => command.name === 'interview');
  assert.ok(interview && interview.kind === 'group');
  assert.doesNotMatch(interview.description, /export/);
  assert.ok(!('end' in interview.subcommands));
  assert.ok(!('forensics' in interview.subcommands));
});

test('registry projection exposes dry-run for every registered command', () => {
  const surface = buildCommandSurface();
  const interview = surface.commands.find(command => command.name === 'interview');
  assert.ok(interview && interview.kind === 'group');
  assert.equal(interview.deprecated, false);
  assert.equal(interview.subcommands.list.destructive, false);
  assert.equal(interview.subcommands.list.dryRunSupported, true);
  assert.equal(interview.subcommands.delete.destructive, true);
  assert.equal(interview.subcommands.delete.dryRunSupported, true);

  const evidence = surface.commands.find(command => command.name === 'evidence');
  assert.ok(evidence && evidence.kind === 'group');
  assert.equal(evidence.subcommands['coverage-gaps'].operation, 'read');
  assert.equal(evidence.subcommands['case-file'].operation, 'read');

  const knowledge = surface.commands.find(command => command.name === 'knowledge');
  assert.ok(knowledge && knowledge.kind === 'group');
  assert.equal(knowledge.subcommands.delete.destructive, true);
  assert.equal(knowledge.subcommands.delete.dryRunSupported, true);

  for (const command of surface.commands) {
    const leaves = command.kind === 'command' ? [command] : Object.values(command.subcommands);
    for (const leaf of leaves) {
      assert.equal(leaf.dryRunSupported, true);
    }
  }

  assert.ok(interview.subcommands.audio.options.some(option => option.name === 'output'));
  assert.ok(interview.subcommands.screen.options.some(option => option.name === 'output'));
  assert.ok(interview.subcommands.watch.options.some(option => option.name === 'evidence' && option.type === 'boolean'));
  assert.ok(interview.subcommands.watch.options.some(option => option.name === 'verbose' && option.type === 'boolean'));
});

test('registry validation consumes the same required options and aliases as help', () => {
  assert.throws(
    () => validateCommandInput('knowledge', 'apply', parseArgs([])),
    /Missing required option: --data/,
  );
  assert.doesNotThrow(() => validateCommandInput(
    'knowledge',
    'apply',
    parseArgs(['--data', '@knowledge.json']),
  ));
  assert.doesNotThrow(() => validateCommandInput('findings', 'update', parseArgs(['tsk_1', '--effort', 'm'])));
  assert.throws(
    () => validateCommandInput('findings', 'update', parseArgs(['tsk_1', '--effort', 'medium'])),
    /Invalid value "medium" for --effort\. Expected one of: xs, s, m, l, xl/,
  );
  assert.throws(
    () => validateCommandInput('findings', 'update', parseArgs(['fnd_1', '--status', 'reviewed'])),
    /Invalid value "reviewed" for --status\. Expected one of: backlog, ready, in_progress, done, wont_fix/,
  );
  assert.doesNotThrow(() => validateCommandInput('init', undefined, parseArgs(['-y'])));
  assert.throws(
    () => validateCommandInput('project', 'verify-widget-installation', parseArgs(['acme/checkout'])),
    /Missing required option: --url/,
  );
  assert.throws(
    () => validateCommandInput('interview', 'watch', parseArgs(['--bogus'])),
    /Unknown flag\(s\): --bogus/,
  );
});

test('shell completions derive nested commands, option aliases, and descriptions from the registry', () => {
  const surface = buildCommandSurface();
  const bash = generateBashCompletions(surface);
  const fish = generateFishCompletions(surface);

  assert.match(bash, /interview/);
  assert.match(bash, /watch/);
  assert.match(bash, /--evidence/);
  assert.match(bash, /findings/);
  assert.doesNotMatch(bash, /\bwork\b/);
  assert.match(bash, /-y/);
  assert.match(fish, /Watch processing progress\./);
  assert.match(fish, /Include newly extracted Evidence while watching processing\./);
  assert.match(fish, /findings/);
  assert.doesNotMatch(fish, /\bwork\b/);
  assert.match(fish, /-s y/);
});

test('every registered required input and option description is internally complete', () => {
  const commands = buildCommandSurface().commands;
  const command = (name: string) => {
    const found = commands.find(candidate => candidate.name === name);
    assert.ok(found);
    return found;
  };
  const subcommand = (groupName: string, name: string) => {
    const group = command(groupName);
    assert.equal(group.kind, 'group');
    return group.subcommands[name];
  };

  assert.equal(subcommand('interview', 'get').auth, 'required');
  assert.equal(subcommand('auth', 'logout').auth, 'none');
  assert.equal(subcommand('auth', 'token').auth, 'required');
  assert.equal(subcommand('study', 'guide').auth, 'none');
  assert.equal(subcommand('project', 'current').auth, 'none');
  assert.equal(subcommand('project', 'use').auth, 'required');

  const init = command('init');
  assert.equal(init.kind, 'command');
  assert.equal(init.auth, 'required');
  assert.equal(init.operation, 'write');
  assert.ok(init.options.some(option => option.name === 'name' && option.required));

  for (const internalName of ['admin', 'api', 'extract', 'config']) {
    assert.equal(commands.some(candidate => candidate.name === internalName), false);
  }
  const interview = command('interview');
  assert.equal(interview.kind, 'group');
  for (const internalName of ['forensics', 'events', 'end', 'retry-media-merge']) {
    assert.equal(internalName in interview.subcommands, false);
  }

  const completions = command('completions');
  assert.equal(completions.kind, 'group');
  assert.equal(completions.subcommands.bash.auth, 'none');
  assert.equal(completions.subcommands.bash.operation, 'read');

  const evidenceList = subcommand('evidence', 'list');
  assert.match(evidenceList.description, /List evidence/);
  assert.equal(evidenceList.pagination?.style, 'limit_offset');
  assert.ok(evidenceList.options.some(option => option.name === 'target-surface' && option.type === 'enum'));
  assert.ok(evidenceList.positionals.some(positional => positional.name === 'projectRef' && !positional.required));

  const verifyWidgetInstallation = subcommand('project', 'verify-widget-installation');
  assert.equal(verifyWidgetInstallation.auth, 'required');
  assert.equal(verifyWidgetInstallation.operation, 'read');
  assert.ok(verifyWidgetInstallation.positionals.some(positional => positional.name === 'projectRef' && !positional.required));
  assert.ok(verifyWidgetInstallation.options.some(option => option.name === 'url' && option.required));
  assert.match(renderCommandHelp('project', 'verify-widget-installation'), /--url <value>.*Exact public HTTPS page for the widget installation preflight.*\(required\)/);

  const projectSnippet = subcommand('project', 'snippet');
  assert.match(projectSnippet.description, /Project-owned install-once widget snippet/);
  assert.match(renderCommandHelp('project', 'snippet'), /Project-owned install-once widget snippet/);

  for (const command of commands) {
    const leaves = command.kind === 'command' ? [command] : Object.values(command.subcommands);
    for (const leaf of leaves) {
      const optionNames = new Set(leaf.options.map(option => option.name));
      assert.equal(optionNames.size, leaf.options.length, `${command.name} has duplicate options`);
      for (const option of leaf.options) {
        assert.doesNotMatch(option.description, /^Set .+\.$/, `${command.name} --${option.name} needs a specific description`);
        if (option.required) assert.ok(optionNames.has(option.name));
      }
      const positionalNames = leaf.positionals.map(positional => positional.name);
      assert.equal(new Set(positionalNames).size, positionalNames.length, `${command.name} has duplicate positionals`);
    }
  }
});
