import type { ParsedArgs } from '../lib/types';
import {
  assertNoExtraPositionals,
  getBooleanOption,
  hasHelpFlag,
  parseEnvironment,
  parseJsonOrFile,
  requireOption,
} from '../lib/args';

import { fail } from '../lib/errors';
import { requestProjectContractJson } from '../lib/contract-api';
import { isJsonOutput, printOutput } from '../lib/output';
import { extractMarkdownH2Section, listMarkdownH2Headings, loadStudyDesignGuideMarkdown } from '../lib/study-guide';
import { consumeProjectRef } from '../lib/project-defaults';
import { normalizePlacementLanguage, normalizeVisibilityPathname } from '../../shared/study-placement';
import { printCommandHelp } from './help-manifest';

export async function handleStudyCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('study');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'resolve': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'study resolve' });
      const pathname = normalizeVisibilityPathname(requireOption(parsed, 'path'));
      const languageInput = parsed.options.language && parsed.options.language !== 'true' ? parsed.options.language : 'en';
      const language = normalizePlacementLanguage(languageInput);
      if (!language) fail(`Unsupported widget language: ${languageInput}. Use en, es, ru, fr, de, zh-Hans, or ja.`);
      const data = await requestProjectContractJson('studyPlacementPreview', {
        env,
        projectRef,
        body: { pathname, language },
      });
      if (isJsonOutput(parsed)) printOutput(data, parsed);
      else {
        const result = data as { outcome: string; study_ref?: string; reason?: string; ambiguous_study_refs?: string[] };
        if (result.outcome === 'match') console.log(`Winner: ${result.study_ref}`);
        else if (result.outcome === 'ambiguous') console.log(`Ambiguous: ${result.ambiguous_study_refs?.join(', ')}`);
        else if (result.outcome === 'unavailable') console.log(`Unavailable: ${result.study_ref} (${result.reason})`);
        else console.log('No Study matches this page and language.');
      }
      return;
    }

    case 'list': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'study list' });

      const data = await requestProjectContractJson('studiesList', {
        env,
        projectRef: projectId,
      });
      printOutput(data, parsed);
      return;
    }

    case 'create': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'study create' });

      const title = requireOption(parsed, 'title');
      const body: Record<string, unknown> = { title };
      if (parsed.options.handle && parsed.options.handle !== 'true') {
        body.handle = parsed.options.handle;
      }

      // Optional string fields
      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      if (parsed.options['intake'] && parsed.options['intake'] !== 'true') {
        body.intake_ref = parsed.options['intake'];
      }

      // Goals: --goals <json|@file>
      const goalsInput = parsed.options.goals;
      if (goalsInput && goalsInput !== 'true') {
        body.goals = await parseJsonOrFile(goalsInput, '--goals');
      }

      // Script: --script <json|@file>
      const scriptInput = parsed.options.script;
      if (scriptInput && scriptInput !== 'true') {
        body.script = await parseJsonOrFile(scriptInput, '--script');
      }

      for (const field of ['invitation', 'visibility'] as const) {
        const input = parsed.options[field];
        if (input && input !== 'true') body[field] = await parseJsonOrFile(input, `--${field}`);
      }

      // Allowed origins: comma-separated list; empty string clears to []
      if ('allowed-origins' in parsed.options) {
        body.allowed_origins = parseAllowedOrigins(parsed.options['allowed-origins']);
      }

      const data = await requestProjectContractJson('studyCreate', {
        env,
        projectRef: projectId,
        body,
      });

      // Auto-activate if --activate flag is set
      if (getBooleanOption(parsed, 'activate')) {
        const study = (data as Record<string, unknown>).study as Record<string, unknown> | undefined;
        const studyRef = typeof study?.handle === 'string' ? study.handle : null;
        if (studyRef) {
          await requestProjectContractJson('studyPatch', {
            env,
            projectRef: projectId,
            pathParams: { studyHandle: studyRef },
            body: { status: 'active' },
          });
          (study as Record<string, unknown>).status = 'active';
        } else {
          fail('Study creation succeeded but the response did not include its handle.');
        }
      }

      // Human-friendly messaging for auto-created intake
      const result = data as {
        study: Record<string, unknown>;
        intake_auto_created?: boolean;
        intake_ref?: string;
      };
      if (!isJsonOutput(parsed)) {
        if (result.intake_auto_created) {
          console.error('Intake auto-created and linked.');
        }
        if (getBooleanOption(parsed, 'activate') && result.intake_auto_created) {
          console.error('Study and linked intake activated.');
        }
      }

      printOutput(data, parsed);
      return;
    }

    case 'get': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study get' });
      const studyRef = args[0];

      const data = await requestProjectContractJson('studyGet', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'update': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study update' });
      const studyRef = args[0];

      const body: Record<string, unknown> = {};

      // Optional string fields
      for (const field of ['title', 'description', 'status', 'handle']) {
        const key = field.replace(/-/g, '_');
        const val = parsed.options[field];
        if (val && val !== 'true') {
          body[key] = val;
        }
      }
      if (parsed.options['intake'] && parsed.options['intake'] !== 'true') {
        body.intake_ref = parsed.options['intake'];
      }

      // Goals: --goals <json|@file>
      const goalsInput = parsed.options.goals;
      if (goalsInput && goalsInput !== 'true') {
        body.goals = await parseJsonOrFile(goalsInput, '--goals');
      }

      // Script: --script <json|@file>
      const scriptInput = parsed.options.script;
      if (scriptInput && scriptInput !== 'true') {
        body.script = await parseJsonOrFile(scriptInput, '--script');
      }

      for (const field of ['invitation', 'visibility'] as const) {
        const input = parsed.options[field];
        if (input && input !== 'true') body[field] = await parseJsonOrFile(input, `--${field}`);
      }

      // Allowed origins: comma-separated list; empty string clears to []
      if ('allowed-origins' in parsed.options) {
        body.allowed_origins = parseAllowedOrigins(parsed.options['allowed-origins']);
      }

      if (Object.keys(body).length === 0) {
        fail('No update fields provided. Use --title, --handle, --description, --status, --goals, --script, --invitation, --visibility, --intake, --allowed-origins.');
      }

      const data = await requestProjectContractJson('studyPatch', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study delete' });
      const studyRef = args[0];

      const data = await requestProjectContractJson('studyDelete', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'export': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study export' });
      const studyRef = args[0];

      const data = await requestProjectContractJson('studyGet', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
      }) as Record<string, unknown>;

      const study = data.study as Record<string, unknown> | undefined;
      const scriptJson = study?.script_json as string | null;

      if (!scriptJson) {
        console.log('{}');
      } else {
        // Output raw JSON for piping
        console.log(scriptJson);
      }
      return;
    }

    case 'import': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study import' });
      const studyRef = args[0];

      const scriptInput = requireOption(parsed, 'script');
      const script = await parseJsonOrFile(scriptInput, '--script');

      const data = await requestProjectContractJson('studyPatch', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
        body: { script },
      });
      printOutput(data, parsed);
      return;
    }

    case 'validate-script': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'study validate-script' });
      const studyRef = args[0];

      const body: Record<string, unknown> = {};
      const scriptInput = parsed.options.script;
      if (scriptInput && scriptInput !== 'true') {
        body.script = await parseJsonOrFile(scriptInput, '--script');
      }

      const data = await requestProjectContractJson('studyReviewScript', {
        env,
        projectRef: projectId,
        pathParams: { studyHandle: studyRef },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'guide': {
      assertNoExtraPositionals(parsed, 0);
      const markdown = await loadStudyDesignGuideMarkdown(env);
      if (markdown === null) {
        fail('Study design guide not found at /guides/study-design.');
      }
      let guideText = markdown;

      // --section <name>: extract matching ## heading section
      const sectionName = parsed.options.section && parsed.options.section !== 'true' ? parsed.options.section : null;
      if (sectionName) {
        const section = extractMarkdownH2Section(guideText, sectionName);
        if (section) {
          guideText = section.content;
        } else {
          const headings = listMarkdownH2Headings(guideText);
          fail(`Section "${sectionName}" not found. Available: ${headings.join(', ')}`);
        }
      }

      // --format json: wrap in JSON
      const format = parsed.options.format && parsed.options.format !== 'true' ? parsed.options.format : null;
      if (format === 'json') {
        console.log(JSON.stringify({ content: guideText }));
      } else {
        console.log(guideText);
      }
      return;
    }

    default:
      fail(`Unknown study command: ${subcommand}`);
  }
}


function parseAllowedOrigins(value: string | undefined): string[] {
  if (value === undefined || value === 'true') {
    fail('--allowed-origins requires a value. Pass a comma-separated list of origins, or --allowed-origins= to clear.');
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
