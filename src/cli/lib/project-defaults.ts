import type { ParsedArgs, CliEnvironment } from './types';
import { assertNoExtraPositionals } from './args';
import { loadCurrentProjectRef } from './config';
import { requestContractJson } from './contract-api';
import { failArgs } from './errors';
import { requireCanonicalProjectRef, type CanonicalProjectRef } from './project-ref';

export async function resolveDefaultOrgHandle(env: CliEnvironment, commandLabel: string): Promise<string> {
  const profile = await requestContractJson('userProfileGet', { env });
  const orgHandle = profile.personal_org_handle;

  if (!orgHandle) {
    failArgs(
      `No default organization handle is available for "${commandLabel}". `
      + 'Run "usertold auth whoami --json" to inspect your profile, or pass an org handle explicitly.',
    );
  }

  return orgHandle;
}

export async function resolveProjectRefWithDefaults(
  projectRef: string,
  env: CliEnvironment,
  sourceLabel = '<projectRef>',
): Promise<CanonicalProjectRef> {
  const value = projectRef.trim();
  if (!value) {
    failArgs(`Missing ${sourceLabel}. Run "usertold project list" or "usertold project use <projectRef>".`);
  }

  if (value.includes('/') || value.startsWith('prj_')) {
    return requireCanonicalProjectRef(value, sourceLabel);
  }

  const orgHandle = await resolveDefaultOrgHandle(env, sourceLabel);
  return { orgHandle, projectHandle: value };
}

export type ProjectRefResolution = {
  projectRef: string;
  args: string[];
  usedCurrentProject: boolean;
};

export async function consumeProjectRef(
  parsed: ParsedArgs,
  env: CliEnvironment,
  options: {
    resourceArgCount: number;
    commandLabel: string;
  },
): Promise<ProjectRefResolution> {
  const explicitProjectRef = parsed.positionals.length > options.resourceArgCount;
  const rawProjectRef = explicitProjectRef
    ? parsed.positionals[0]
    : await requireCurrentProjectRef(env, options.commandLabel);
  const args = explicitProjectRef ? parsed.positionals.slice(1) : parsed.positionals;

  if (args.length < options.resourceArgCount) {
    failArgs(
      `Missing required argument for "${options.commandLabel}". `
      + `Expected ${options.resourceArgCount} resource argument(s) after the project.`,
    );
  }
  assertNoExtraPositionals({ ...parsed, positionals: args }, options.resourceArgCount);

  const canonical = await resolveProjectRefWithDefaults(rawProjectRef, env, '<projectRef>');
  return {
    projectRef: `${canonical.orgHandle}/${canonical.projectHandle}`,
    args,
    usedCurrentProject: !explicitProjectRef,
  };
}

export async function requireCurrentProjectRef(env: CliEnvironment, commandLabel: string): Promise<string> {
  const currentProjectRef = await loadCurrentProjectRef(env);
  if (!currentProjectRef) {
    failArgs(
      `Missing project for "${commandLabel}". `
      + 'Pass <projectRef>, or set a default with "usertold project use <projectRef>".',
    );
  }

  return currentProjectRef;
}
