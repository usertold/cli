import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag, parseEnvironment, requireOption } from '../lib/args';
import { fail, failArgs } from '../lib/errors';
import { requestProjectContract } from '../lib/contract-api';
import { printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import { printCommandHelp } from './help-manifest';

const SETTING_KEYS = ['openai_api_key', 'retention_days'] as const;
type SettingKey = typeof SETTING_KEYS[number];

export async function handleSettingsCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help') {
    printCommandHelp('settings');
    return;
  }

  const env = parseEnvironment(parsed);
  const { projectRef } = await consumeProjectRef(parsed, env, {
    resourceArgCount: 0,
    commandLabel: `settings ${subcommand}`,
  });

  switch (subcommand) {
    case 'show':
      printOutput(await requestProjectContract({ env, key: 'settingsGet', projectRef }), parsed);
      return;
    case 'set': {
      const key = parseSettingKey(parsed);
      const value = requireOption(parsed, 'value');
      printOutput(await requestProjectContract({
        env,
        key: 'settingsPatch',
        projectRef,
        body: { [key]: value },
      }), parsed);
      return;
    }
    case 'delete': {
      const key = parseSettingKey(parsed);
      printOutput(await requestProjectContract({
        env,
        key: 'settingsPatch',
        projectRef,
        body: { [key]: '' },
      }), parsed);
      return;
    }
    case 'validate': {
      const key = parseSettingKey(parsed);
      printOutput(await requestProjectContract({
        env,
        key: 'settingsValidate',
        projectRef,
        body: { key, value: requireOption(parsed, 'value') },
      }), parsed);
      return;
    }
    case 'key-health':
      printOutput(await requestProjectContract({ env, key: 'settingsKeyHealth', projectRef }), parsed);
      return;
    default:
      fail(`Unknown settings command: ${subcommand}`);
  }
}

function parseSettingKey(parsed: ParsedArgs): SettingKey {
  const key = parsed.options.key;
  if (!SETTING_KEYS.includes(key as SettingKey)) {
    failArgs(`Missing or invalid --key. Expected: ${SETTING_KEYS.join(' or ')}.`);
  }
  return key as SettingKey;
}
