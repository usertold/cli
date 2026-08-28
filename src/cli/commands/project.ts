import type { ParsedArgs } from '../lib/types';
import {
  assertNoExtraPositionals,
  hasHelpFlag,
  parseEnvironment,
  requireOption,
  requirePositional,
} from '../lib/args';

import { fail, failNotFound } from '../lib/errors';
import { requestContractJson, requestProjectContractJson } from '../lib/contract-api';
import { isJsonOutput, printOutput } from '../lib/output';
import { requireCanonicalProjectRef } from '../lib/project-ref';
import { saveCurrentProjectRef } from '../lib/config';
import { consumeProjectRef, requireCurrentProjectRef, resolveDefaultOrgHandle, resolveProjectRefWithDefaults } from '../lib/project-defaults';
import { buildProjectWidgetEmbedDetails, resolveWidgetEmbedOriginForEnvironment, type ProjectWidgetEmbedDetails } from '../../shared/widget-embed';
import { handleOverviewCommand } from './overview';
import { printCommandHelp } from './help-manifest';
import type {
  ApiWidgetInstallationCheck,
  ApiWidgetInstallationVerificationReport,
} from '../../shared/schemas/response-widget-installation';

export function formatProjectSnippetHumanOutput(embed: ProjectWidgetEmbedDetails): string {
  return `${embed.snippet}\n\n${embed.guidance}`;
}

export async function handleProjectCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('project');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'list': {
      const hasOrgOption = parsed.options.org && parsed.options.org !== 'true';
      const positionalOrgHandle = parsed.positionals[0];
      const orgHandle = hasOrgOption
        ? parsed.options.org
        : positionalOrgHandle ?? await resolveDefaultOrgHandle(env, 'project list');
      assertNoExtraPositionals(parsed, hasOrgOption ? 0 : positionalOrgHandle ? 1 : 0);
      const data = await requestContractJson('projectList', {
        env,
        pathParams: { orgHandle },
      });
      printOutput(data, parsed);
      return;
    }

    case 'use': {
      const rawProjectRef = requirePositional(parsed, 0, '<projectRef>');
      assertNoExtraPositionals(parsed, 1);
      const project = await resolveProjectRefWithDefaults(rawProjectRef, env, '<projectRef>');

      const data = await requestContractJson('projectGet', {
        env,
        pathParams: { orgHandle: project.orgHandle, projectHandle: project.projectHandle },
      });

      const projectRef = `${project.orgHandle}/${project.projectHandle}`;
      await saveCurrentProjectRef(env, projectRef);

      if (isJsonOutput(parsed)) {
        printOutput({ current_project: projectRef, project: data.project }, parsed);
      } else {
        console.log(`Current project (${env}): ${projectRef}`);
      }
      return;
    }

    case 'current': {
      assertNoExtraPositionals(parsed, 0);
      const project = await resolveProjectRefWithDefaults(await requireCurrentProjectRef(env, 'project current'), env);
      const projectRef = `${project.orgHandle}/${project.projectHandle}`;

      if (isJsonOutput(parsed)) {
        console.log(JSON.stringify({ current_project: projectRef }, null, 2));
      } else {
        console.log(`Current project (${env}): ${projectRef}`);
      }
      return;
    }

    case 'create': {
      const hasOrgOption = parsed.options.org && parsed.options.org !== 'true';
      const positionalOrgHandle = parsed.positionals[0];
      const orgHandle = hasOrgOption
        ? parsed.options.org
        : positionalOrgHandle ?? await resolveDefaultOrgHandle(env, 'project create');
      assertNoExtraPositionals(parsed, hasOrgOption ? 0 : positionalOrgHandle ? 1 : 0);
      const name = requireOption(parsed, 'name');
      const body: Record<string, unknown> = {
        name,
      };
      if (parsed.options.handle && parsed.options.handle !== 'true') {
        body.handle = parsed.options.handle;
      }

      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      const data = await requestContractJson('projectCreate', {
        env,
        pathParams: { orgHandle },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'get': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'project get' });
      const { orgHandle, projectHandle } = requireCanonicalProjectRef(projectRef, '<projectRef>');
      const data = await requestContractJson('projectGet', {
        env,
        pathParams: { orgHandle, projectHandle },
      });
      printOutput(data, parsed);
      return;
    }

    case 'update': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'project update' });
      const { orgHandle, projectHandle } = requireCanonicalProjectRef(projectRef, '<projectRef>');

      const body: Record<string, unknown> = {};
      if (parsed.options.name && parsed.options.name !== 'true') {
        body.name = parsed.options.name;
      }
      if (parsed.options.handle && parsed.options.handle !== 'true') {
        body.handle = parsed.options.handle;
      }
      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      if (Object.keys(body).length === 0) {
        fail('No fields to update. Provide at least one of: --name, --handle, --description');
      }

      const data = await requestContractJson('projectPatch', {
        env,
        pathParams: { orgHandle, projectHandle },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const rawProjectRef = requirePositional(parsed, 0, '<projectRef>');
      assertNoExtraPositionals(parsed, 1);
      const { orgHandle, projectHandle } = await resolveProjectRefWithDefaults(rawProjectRef, env, '<projectRef>');

      const data = await requestContractJson('projectDelete', {
        env,
        pathParams: { orgHandle, projectHandle },
      });
      printOutput(data, parsed);
      return;
    }

    case 'snippet': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'project snippet' });
      const { orgHandle, projectHandle } = requireCanonicalProjectRef(projectRef, '<projectRef>');

      const data = await requestContractJson('projectGet', {
        env,
        pathParams: { orgHandle, projectHandle },
      });

      const publicKey = data.project?.public_key as string;
      if (!publicKey) {
        failNotFound('Could not retrieve project public key');
      }

      const widgetOrigin = resolveWidgetEmbedOriginForEnvironment(env);
      const embed = buildProjectWidgetEmbedDetails({
        origin: widgetOrigin,
        projectKey: publicKey,
      });

      if (isJsonOutput(parsed)) {
        console.log(JSON.stringify(embed));
      } else {
        console.log(formatProjectSnippetHumanOutput(embed));
      }
      return;
    }

    case 'verify-widget-installation': {
      const { projectRef } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 0,
        commandLabel: 'project verify-widget-installation',
      });
      const url = requireOption(parsed, 'url');
      const report = await requestProjectContractJson('projectWidgetInstallationVerify', {
        env,
        projectRef,
        body: { url },
      });

      if (isJsonOutput(parsed)) {
        printOutput(report, parsed);
      } else {
        printWidgetInstallationVerificationReport(report);
      }

      if (report.overall_status === 'fail') {
        process.exitCode = 1;
      }
      return;
    }

    case 'status': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'project status' });
      const { orgHandle, projectHandle } = requireCanonicalProjectRef(projectRef, '<projectRef>');

      // Parallel fetch of project, settings, overview
      const [projectData, settingsData, overviewData] = await Promise.all([
        requestContractJson('projectGet', {
          env,
          pathParams: { orgHandle, projectHandle },
        }),
        requestContractJson('settingsGet', {
          env,
          pathParams: { orgHandle, projectHandle },
        }),
        requestContractJson('overview', {
          env,
          pathParams: { orgHandle, projectHandle },
        }),
      ]);

      const project = projectData.project;
      const settings = settingsData.settings;
      const overview = overviewData;

      const githubConnected = !!project?.github_repo_url;
      const openaiConfigured = !!settings?.openai_api_key;
      const sessions = overview?.sessions as Record<string, unknown> | undefined;
      const signals = overview?.signals as Record<string, unknown> | undefined;
      const sessionCount = (sessions?.total as number) ?? 0;
      const signalCount = (signals?.total as number) ?? 0;

      const status = {
        project_ref: projectRef,
        name: project?.name,
        github_connected: githubConnected,
        github_repo: project?.github_repo_url ?? null,
        openai_key_configured: openaiConfigured,
        interview_count: sessionCount,
        evidence_count: signalCount,
        ready: openaiConfigured && sessionCount >= 0,
      };

      if (isJsonOutput(parsed)) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`Project: ${status.name} (${projectRef})`);
        console.log(`OpenAI key: ${status.openai_key_configured ? 'configured' : 'not set'}`);
        console.log(`GitHub: ${githubConnected ? `connected (${project?.github_repo_url})` : 'not connected'}`);
        console.log(`Interviews: ${sessionCount}`);
        console.log(`Evidence: ${signalCount}`);
      }
      return;
    }

    case 'overview': {
      await handleOverviewCommand(parsed);
      return;
    }

    default:
      fail(`Unknown project command: ${subcommand}`);
  }
}

export function printWidgetInstallationVerificationReport(report: ApiWidgetInstallationVerificationReport): void {
  console.log(`Website integration check: ${report.overall_status.toUpperCase()}`);
  console.log(`Requested URL: ${report.requested_url}`);
  console.log(`Final URL: ${report.final_url ?? 'not reached'}`);
  console.log(
    `Checks: ${report.summary.passed} passed, ${report.summary.warnings} warning(s), ${report.summary.failed} failed`,
  );

  for (const check of report.checks) {
    printWidgetInstallationCheck(check);
  }
}

function printWidgetInstallationCheck(check: ApiWidgetInstallationCheck): void {
  console.log('');
  console.log(`${check.status.toUpperCase()}  ${check.title} (${check.id})`);
  console.log(`  ${check.message}`);
  if (check.observed !== undefined) {
    const observed = Array.isArray(check.observed) ? check.observed.join(', ') : check.observed;
    console.log(`  Observed: ${observed}`);
  }
  if (check.expected) console.log(`  Expected: ${check.expected}`);
  if (check.recommendation) console.log(`  Recommendation: ${check.recommendation}`);
  if (check.remediation_snippet) console.log(`  Configuration: ${check.remediation_snippet}`);
}
