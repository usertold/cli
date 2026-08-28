import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag, parseEnvironment, requireOption, requirePositional } from '../lib/args';
import { fail, failArgs } from '../lib/errors';
import { requestJson } from '../lib/http';
import { printOutput } from '../lib/output';
import { requireCanonicalProjectRef } from '../lib/project-ref';
import { printCommandHelp } from './help-manifest';

export async function handleOrganizationCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help') {
    printCommandHelp('organization');
    return;
  }

  const env = parseEnvironment(parsed);
  switch (subcommand) {
    case 'list':
      printOutput(await requestJson({ env, method: 'GET', path: '/api/organizations/me' }), parsed);
      return;
    case 'create':
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: '/api/organizations',
        body: { orgName: requireOption(parsed, 'name'), orgHandle: requireOption(parsed, 'handle') },
      }), parsed);
      return;
    case 'participants': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      printOutput(await requestJson({ env, method: 'GET', path: orgPath(org, 'participants') }), parsed);
      return;
    }
    case 'update-participant': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      const userId = requirePositional(parsed, 1, 'userId');
      printOutput(await requestJson({
        env,
        method: 'PATCH',
        path: `${orgPath(org, 'participants')}/${encodeURIComponent(userId)}`,
        body: { role: parseRole(parsed), projectAccess: parseProjectAccess(parsed) },
      }), parsed);
      return;
    }
    case 'remove-participant': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      const userId = requirePositional(parsed, 1, 'userId');
      printOutput(await requestJson({
        env,
        method: 'DELETE',
        path: `${orgPath(org, 'participants')}/${encodeURIComponent(userId)}`,
      }), parsed);
      return;
    }
    case 'invitations': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      printOutput(await requestJson({ env, method: 'GET', path: orgPath(org, 'invitations') }), parsed);
      return;
    }
    case 'invite': {
      const org = requirePositional(parsed, 0, 'orgHandle');
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: orgPath(org, 'invitations'),
        body: {
          email: requireOption(parsed, 'email'),
          role: parseRole(parsed),
          projectAccess: parseProjectAccess(parsed),
        },
      }), parsed);
      return;
    }
    case 'share-project': {
      const project = requireCanonicalProjectRef(requirePositional(parsed, 0, 'projectRef'));
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: `${orgPath(project.orgHandle, `projects/${encodeURIComponent(project.projectHandle)}`)}/share`,
        body: { email: requireOption(parsed, 'email') },
      }), parsed);
      return;
    }
    case 'resend-invitation':
      await invitationAction(parsed, env, 'POST', 'resend');
      return;
    case 'revoke-invitation':
      await invitationAction(parsed, env, 'DELETE');
      return;
    case 'inspect-invitation':
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: '/api/organization-invitations/inspect',
        authMode: 'none',
        body: { token: requireOption(parsed, 'token') },
      }), parsed);
      return;
    case 'accept-invitation':
      printOutput(await requestJson({
        env,
        method: 'POST',
        path: '/api/organization-invitations/accept',
        body: {
          token: requireOption(parsed, 'token'),
          organizationHandle: requirePositional(parsed, 0, 'orgHandle'),
        },
      }), parsed);
      return;
    default:
      fail(`Unknown organization command: ${subcommand}`);
  }
}

async function invitationAction(
  parsed: ParsedArgs,
  env: ReturnType<typeof parseEnvironment>,
  method: 'POST' | 'DELETE',
  suffix = '',
): Promise<void> {
  const org = requirePositional(parsed, 0, 'orgHandle');
  const invitationId = requirePositional(parsed, 1, 'invitationId');
  const path = `${orgPath(org, 'invitations')}/${encodeURIComponent(invitationId)}${suffix ? `/${suffix}` : ''}`;
  printOutput(await requestJson({ env, method, path }), parsed);
}

function orgPath(orgHandle: string, suffix: string): string {
  return `/api/organizations/${encodeURIComponent(orgHandle)}/${suffix}`;
}

function parseRole(parsed: ParsedArgs): 'owner' | 'admin' | 'member' {
  const role = parsed.options.role;
  if (role !== 'owner' && role !== 'admin' && role !== 'member') {
    failArgs('Missing or invalid --role. Expected: owner, admin, or member.');
  }
  return role;
}

function parseProjectAccess(parsed: ParsedArgs): { scope: 'all' } | { scope: 'selected'; projectIds: string[] } {
  const access = parsed.options.access ?? 'all';
  if (access === 'all') return { scope: 'all' };
  if (access !== 'selected') failArgs('Invalid --access. Expected: all or selected.');
  const projectIds = (parsed.options.projects ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (projectIds.length === 0) failArgs('--projects is required when --access selected.');
  return { scope: 'selected', projectIds };
}
