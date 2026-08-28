import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag, parseEnvironment } from '../lib/args';

import { requestContract, requestProjectContract } from '../lib/contract-api';
import { fail, failAuth } from '../lib/errors';
import { loadStoredConfig } from '../lib/config';
import { isJsonOutput } from '../lib/output';
import { isInteractive } from '../lib/tty';
import { prompt, promptYesNo } from '../lib/prompt';
import { resolveDefaultOrgHandle } from '../lib/project-defaults';
import { buildWidgetEmbedSnippet, resolveWidgetEmbedOriginForEnvironment } from '../../shared/widget-embed';
import { printCommandHelp } from './help-manifest';

export function buildInitHumanOutput(
  result: Record<string, unknown>,
  projectRef: string,
  publicKey: string,
  snippet: string | null,
): string[] {
  const lines = [
    '',
    'Setup complete!',
    '',
    `Project:    ${projectRef}`,
    `Public Key: ${publicKey}`,
  ];
  if (result.study) {
    lines.push(`Study:      ${(result.study as Record<string, unknown>).ref}`);
  }
  if (result.intake) {
    lines.push(`Intake:     ${(result.intake as Record<string, unknown>).ref}`);
  }
  lines.push('');
  if (snippet) {
    lines.push('Widget snippet:', `  ${snippet}`);
  } else {
    lines.push('Widget snippet: run project snippet after the project public key is available.');
  }
  return lines;
}

export async function handleInitCommand(parsed: ParsedArgs): Promise<void> {
  if (hasHelpFlag(parsed)) {
    printCommandHelp('init');
    return;
  }

  const env = parseEnvironment(parsed);
  const interactive = isInteractive(parsed);
  const json = isJsonOutput(parsed);

  const result: Record<string, unknown> = {};

  // Step 1: Auth — verify we have a valid token
  const hasEnvToken = !!process.env.USERTOLD_API_KEY;
  if (!hasEnvToken) {
    const config = await loadStoredConfig(env);
    if (!config || config.token.expiresAt <= Date.now()) {
      if (interactive) {
        console.error(`No valid token for environment "${env}".`);
        console.error(`Run: usertold auth login --env ${env}`);
        failAuth('Authentication required. Run auth login first.');
      } else {
        failAuth('No valid token. Set USERTOLD_API_KEY or run auth login.');
      }
    }
  }

  // Step 2: Create project
  let projectName = parsed.options.name;
  if (!projectName || projectName === 'true') {
    if (interactive) {
      projectName = await prompt('Project name');
      if (!projectName) fail('Project name is required');
    } else {
      fail('--name is required in non-interactive mode');
    }
  }

  if (!json) console.error(`Creating project "${projectName}"...`);
  const targetOrgHandle = await resolveOrgHandleForInit(parsed, env);

  const projectData = await requestContract({
    env,
    key: 'projectCreate',
    pathParams: { orgHandle: targetOrgHandle },
    body: { name: projectName },
  });

  const project = projectData.project;
  const publicKey = project.public_key as string;
  const orgHandle = project.org_handle as string | null;
  const projectHandle = (project.project_handle as string | undefined) ?? (project.handle as string | undefined);

  if (!orgHandle || !projectHandle) {
    fail('Project creation response is missing canonical org/project handles required for setup calls.');
  }

  const projectRef = `${orgHandle}/${projectHandle}`;

  result.project = {
    ref: projectRef,
    handle: projectHandle,
    public_key: publicKey,
    name: projectName,
  };
  if (!json) console.error(`Project created: ${projectRef}`);

  // Step 3: Create study (auto-creates intake via backend)
  let studyTitle = parsed.options['study-title'];
  const autoStudy = parsed.options.yes === 'true' || parsed.options.y === 'true';

  if ((!studyTitle || studyTitle === 'true') && interactive) {
    const wantStudy = await promptYesNo('Create an interview study?');
    if (wantStudy) {
      studyTitle = await prompt('Study title', 'User Research Study');
    }
  } else if (autoStudy && (!studyTitle || studyTitle === 'true')) {
    studyTitle = 'User Research Study';
  }

  if (studyTitle && studyTitle !== 'true') {
    if (!json) console.error(`Creating study "${studyTitle}" (auto-creates intake)...`);

    const studyData = await requestProjectContract({
      env,
      key: 'studyCreate',
      projectRef,
      sourceLabel: 'created project reference',
      body: {
        title: studyTitle,
        visibility: { version: 1, enabled: true, rules: [], priority: 0, order: 0 },
      },
    });

    const studyRef = studyData.study.handle as string;
    if (!studyRef) {
      fail('Study creation response is missing the study handle required for subsequent setup calls.');
    }
    if (!json) console.error(`Study created: ${studyRef}`);

    // Activate study (cascades to intake)
    await requestProjectContract({
      env,
      key: 'studyPatch',
      projectRef,
      sourceLabel: 'created project reference',
      pathParams: { studyHandle: studyRef },
      body: { status: 'active' },
    });

    result.study = { ref: studyRef, handle: studyRef, title: studyTitle };
    if (studyData.intake_ref) {
      result.intake = { ref: studyData.intake_ref, handle: studyData.intake_ref, title: studyTitle };
    }
    if (!json) console.error('Study and intake activated.');
  }

  // Optional BYOK override. The platform key can run first interviews, so init
  // never prompts for this on the activation path.
  const openaiKey = parsed.options['openai-key'];
  if (openaiKey && openaiKey !== 'true') {
    if (!json) console.error('Storing optional OpenAI API key...');
    await requestProjectContract({
      env,
      key: 'settingsPatch',
      projectRef,
      sourceLabel: 'created project reference',
      body: { openai_api_key: openaiKey },
    });
    if (!json) console.error('OpenAI key stored');
  }

  // Step 5: Widget snippet
  const widgetOrigin = resolveWidgetEmbedOriginForEnvironment(env);
  const snippet = buildWidgetEmbedSnippet({ async: true, origin: widgetOrigin, projectKey: publicKey });
  result.widget_snippet = snippet;

  // Output
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const line of buildInitHumanOutput(result, projectRef, publicKey, snippet)) {
      console.log(line);
    }
  }
}


async function resolveOrgHandleForInit(parsed: ParsedArgs, env: ReturnType<typeof parseEnvironment>): Promise<string> {
  const orgHandle = parsed.options.org;
  if (orgHandle && orgHandle !== 'true') {
    return orgHandle;
  }

  return resolveDefaultOrgHandle(env, 'init');
}
