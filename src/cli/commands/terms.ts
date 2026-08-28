import type { ParsedArgs } from '../lib/types';
import { loadStoredConfig } from '../lib/config';
import { parseEnvironment } from '../lib/args';
import { fail } from '../lib/errors';
import { requestJson } from '../lib/http';
import { isJsonOutput } from '../lib/output';

type SessionUser = {
  terms_accepted_version?: string | null;
  terms_accepted_at?: string | null;
  needs_terms_acceptance?: boolean;
  terms_update_available?: boolean;
  needs_org_handle_review?: boolean;
};

type SessionResponse = { user: SessionUser | null };
type OnboardingResponse = { user: SessionUser | null };

export async function handleTermsCommand(parsed: ParsedArgs): Promise<void> {
  const action = parsed.positionals[0];

  if (action === 'accept') {
    await acceptTerms(parsed);
    return;
  }

  if (action !== undefined && action !== 'review' && action !== 'status') {
    fail(`Unknown terms command: ${action}. Use "usertold auth terms" or "usertold auth terms accept".`);
  }

  await reviewTerms(parsed);
}

async function reviewTerms(parsed: ParsedArgs): Promise<void> {
  const env = parseEnvironment(parsed);
  const config = await requireAuth(env);

  const session = await requestJson<SessionResponse>({
    env,
    method: 'GET',
    path: '/api/auth/session',
    authMode: 'required',
  });

  const user = session.user;
  const acceptedVersion = user?.terms_accepted_version ?? null;
  const needsAcceptance = user?.needs_terms_acceptance === true;
  const updateAvailable = user?.terms_update_available === true;
  const termsUrl = `${config.baseUrl.replace(/\/$/, '')}/terms`;

  if (isJsonOutput(parsed)) {
    console.log(JSON.stringify({
      environment: env,
      termsUrl,
      acceptedVersion,
      needsAcceptance,
      updateAvailable,
    }, null, 2));
    return;
  }

  console.log(`environment: ${env}`);
  console.log(`terms_url: ${termsUrl}`);
  console.log(`accepted_version: ${acceptedVersion ?? 'none'}`);
  if (needsAcceptance) {
    console.log('status: OUT OF DATE — the Terms of Service have changed.');
    console.log('action: run `usertold auth terms accept` to accept the latest Terms.');
  } else if (updateAvailable) {
    console.log('status: updated — the Terms changed since you accepted; continued use means acceptance.');
    console.log(`action: none required. Review at ${termsUrl}, or run \`usertold auth terms accept\` to record the latest version.`);
  } else {
    console.log('status: up to date');
  }
}

async function acceptTerms(parsed: ParsedArgs): Promise<void> {
  const env = parseEnvironment(parsed);
  const config = await requireAuth(env);

  // `auth terms accept` accepts the Terms only. If the account still needs
  // workspace review, send the user to full onboarding instead.
  const session = await requestJson<SessionResponse>({
    env,
    method: 'GET',
    path: '/api/auth/session',
    authMode: 'required',
  });
  if (session.user?.needs_org_handle_review) {
    const onboardingUrl = `${config.baseUrl.replace(/\/$/, '')}/onboarding`;
    fail(`Your workspace also needs review. Complete onboarding at ${onboardingUrl} — `
      + '`usertold auth terms accept` only accepts the Terms of Service and will not review your workspace handle.');
  }

  const result = await requestJson<OnboardingResponse>({
    env,
    method: 'POST',
    path: '/api/auth/onboarding',
    body: { acceptTerms: true },
    authMode: 'required',
  });

  const acceptedVersion = result.user?.terms_accepted_version ?? null;

  if (isJsonOutput(parsed)) {
    console.log(JSON.stringify({ accepted: true, acceptedVersion }, null, 2));
    return;
  }

  console.log(acceptedVersion
    ? `Accepted the Terms of Service (version ${acceptedVersion}).`
    : 'Accepted the Terms of Service.');
}

async function requireAuth(env: ReturnType<typeof parseEnvironment>) {
  const config = await loadStoredConfig(env);
  if (!config) {
    fail(`Not authenticated for environment "${env}". Run "usertold auth login -- --env ${env}" first.`);
  }
  if (config.token.expiresAt <= Date.now()) {
    fail(`Stored token for environment "${env}" is expired. Run "usertold auth login -- --env ${env}" again.`);
  }
  return config;
}
