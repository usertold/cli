import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag, parseEnvironment, requireOption, requirePositional } from '../lib/args';
import { resolveBaseUrl } from '../lib/config';
import { fail } from '../lib/errors';
import { requestJson } from '../lib/http';
import { printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import { requireCanonicalProjectRef } from '../lib/project-ref';
import { printCommandHelp } from './help-manifest';

export async function handleIntegrationCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help') {
    printCommandHelp('integration');
    return;
  }

  const env = parseEnvironment(parsed);
  switch (subcommand) {
    case 'github-install-url': {
      const project = await projectFromArgs(parsed, env, 'integration github-install-url');
      printOutput({
        url: `${resolveBaseUrl(env)}${projectPath(project, 'github-app/install')}`,
        note: 'Open this URL in an authenticated browser. Use `usertold auth browser-session --output storage-state.json` for browser automation.',
      }, parsed);
      return;
    }
    case 'github-installations':
      await githubRead(parsed, env, 'github-app/installations');
      return;
    case 'github-repositories':
      await githubRead(parsed, env, 'github-app/repos');
      return;
    case 'github-diagnostics':
      await githubRead(parsed, env, 'github-app/diagnostics');
      return;
    case 'github-verify':
      await githubWrite(parsed, env, 'POST', 'github-app/verify');
      return;
    case 'github-select-installation':
      await githubWrite(parsed, env, 'POST', 'github-app/select-installation', {
        installation_id: requireOption(parsed, 'installation-id'),
      });
      return;
    case 'github-select-repository':
      await githubWrite(parsed, env, 'POST', 'github-app/select-repo', {
        repo_url: requireOption(parsed, 'repo'),
        ...(parsed.options.branch && parsed.options.branch !== 'true' ? { default_branch: parsed.options.branch } : {}),
      });
      return;
    case 'github-disconnect':
      await githubWrite(parsed, env, 'DELETE', 'github-app/connection');
      return;
    case 'linear-connect-url': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      const url = new URL(`/api/orgs/${encodeURIComponent(org)}/linear/connect`, resolveBaseUrl(env));
      if (parsed.options['return-to'] && parsed.options['return-to'] !== 'true') {
        url.searchParams.set('return_to', parsed.options['return-to']);
      }
      printOutput({
        url: url.toString(),
        note: 'Open this URL in an authenticated browser. Use `usertold auth browser-session --output storage-state.json` for browser automation.',
      }, parsed);
      return;
    }
    case 'linear-status': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      printOutput(await requestJson({ env, method: 'GET', path: `/api/orgs/${encodeURIComponent(org)}/linear/connection` }), parsed);
      return;
    }
    case 'linear-teams': {
      const project = await projectFromArgs(parsed, env, 'integration linear-teams');
      printOutput(await requestJson({ env, method: 'GET', path: projectPath(project, 'linear/teams') }), parsed);
      return;
    }
    case 'linear-select-team': {
      const project = await projectFromArgs(parsed, env, 'integration linear-select-team');
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: projectPath(project, 'linear/select-team'),
        body: { team_id: requireOption(parsed, 'team-id') },
      }), parsed);
      return;
    }
    case 'linear-disconnect': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      printOutput(await requestJson({ env, method: 'DELETE', path: `/api/orgs/${encodeURIComponent(org)}/linear/connection` }), parsed);
      return;
    }
    default:
      fail(`Unknown integration command: ${subcommand}`);
  }
}

type Project = { orgHandle: string; projectHandle: string };

async function projectFromArgs(parsed: ParsedArgs, env: ReturnType<typeof parseEnvironment>, label: string): Promise<Project> {
  const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: label });
  return requireCanonicalProjectRef(projectRef);
}

function projectPath(project: Project, suffix: string): string {
  return `/api/orgs/${encodeURIComponent(project.orgHandle)}/projects/${encodeURIComponent(project.projectHandle)}/${suffix}`;
}

async function githubRead(parsed: ParsedArgs, env: ReturnType<typeof parseEnvironment>, suffix: string): Promise<void> {
  const project = await projectFromArgs(parsed, env, `integration ${suffix}`);
  printOutput(await requestJson({ env, method: 'GET', path: projectPath(project, suffix) }), parsed);
}

async function githubWrite(
  parsed: ParsedArgs,
  env: ReturnType<typeof parseEnvironment>,
  method: 'POST' | 'DELETE',
  suffix: string,
  body?: Record<string, string>,
): Promise<void> {
  const project = await projectFromArgs(parsed, env, `integration ${suffix}`);
  printOutput(await requestJson({ env, method, path: projectPath(project, suffix), body }), parsed);
}
