import process from 'node:process';
import type { ParsedArgs, StoredConfig } from '../lib/types';
import {
  DEFAULT_CLIENT_ID,
  DEFAULT_REDIRECT_PORT,
  AUTH_SCOPES,
  fetchOidcConfiguration,
  exchangeCodeForToken,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  startAuthorizationCodeListener,
  openBrowser,
} from '../lib/auth';
import { resolveBaseUrl, saveConfig, getConfigPath } from '../lib/config';
import { parseEnvironment, getBooleanOption } from '../lib/args';

const SUCCESSFUL_LOGIN_EXIT_INSURANCE_MS = 500;

export async function handleLogin(parsed: ParsedArgs) {
  const env = parseEnvironment(parsed);
  const baseUrl = resolveBaseUrl(env);
  const clientId = DEFAULT_CLIENT_ID;
  const insecure = env === 'local';

  // --token <jwt>: skip OAuth, store the token directly
  const rawToken = parsed.options.token;
  if (rawToken && rawToken !== 'true') {
    const storedConfig: StoredConfig = {
      environment: env,
      baseUrl,
      clientId,
      token: {
        accessToken: rawToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        issuedAt: Date.now(),
        scope: AUTH_SCOPES,
      },
      user: null,
      updatedAt: new Date().toISOString(),
    };

    await saveConfig(storedConfig);
    console.log(`Token saved for environment "${env}". Credentials at ${await getConfigPath()}`);
    return;
  }

  const requestedRedirectPort = parsed.options.port && parsed.options.port !== 'true'
    ? parseInt(parsed.options.port, 10)
    : DEFAULT_REDIRECT_PORT;

  if (insecure) {
    console.log('⚠️  SSL certificate verification disabled (local dev mode)');
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  console.log(`Starting login for environment "${env}" using ${baseUrl}`);

  const oidcConfig = await fetchOidcConfiguration(baseUrl, insecure);
  const authorizationEndpoint = oidcConfig.authorization_endpoint;

  if (typeof authorizationEndpoint !== 'string' || authorizationEndpoint.length === 0) {
    throw new Error('OIDC configuration missing authorization_endpoint');
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const authorizationCodeListener = startAuthorizationCodeListener(requestedRedirectPort, state);
  const redirectPort = await authorizationCodeListener.ready;
  const redirectUri = `http://127.0.0.1:${redirectPort}/callback`;

  const authUrl = new URL(authorizationEndpoint);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', AUTH_SCOPES);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');

  // Always print the URL so it works on headless/remote hosts
  console.log('\nOpen this URL in your browser to authenticate:\n');
  console.log(authUrl.toString());
  console.log('');
  console.log(`Waiting for OAuth callback on http://127.0.0.1:${redirectPort}/callback ...`);
  console.log('Tip: If on a remote host, set up an SSH tunnel:');
  console.log(`  ssh -L ${redirectPort}:127.0.0.1:${redirectPort} <remote-host>\n`);

  const noBrowser = getBooleanOption(parsed, 'no-browser');
  if (!noBrowser) {
    try {
      await openBrowser(authUrl.toString());
      console.log('(Browser opened automatically)');
    } catch {
      console.log('(Could not open browser — use the URL above)');
    }
  }

  const { code } = await authorizationCodeListener.result;

  console.log('Received authorization code. Exchanging for access token...');
  const tokenResponse = await exchangeCodeForToken({
    baseUrl,
    code,
    codeVerifier,
    redirectUri,
    clientId,
  });

  const storedConfig: StoredConfig = {
    environment: env,
    baseUrl,
    clientId,
    token: {
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      issuedAt: Date.now(),
      scope: tokenResponse.scope,
    },
    user: tokenResponse.user ?? null,
    updatedAt: new Date().toISOString(),
  };

  await saveConfig(storedConfig);
  if (
    tokenResponse.user
    && typeof tokenResponse.user === 'object'
    && 'needs_onboarding' in tokenResponse.user
    && tokenResponse.user.needs_onboarding === true
  ) {
    const needsTermsAcceptance = Boolean((tokenResponse.user as { needs_terms_acceptance?: unknown }).needs_terms_acceptance);
    const needsOrgHandleReview = Boolean((tokenResponse.user as { needs_org_handle_review?: unknown }).needs_org_handle_review);

    console.log('Account setup required before using the API.');
    console.log('Next steps:');
    console.log('1) Open the onboarding page:');
    console.log(`   ${baseUrl}/onboarding`);
    if (needsTermsAcceptance) {
      console.log('2) Accept the latest Terms of Service.');
    } else {
      console.log('2) Review your organization handle and workspace name.');
    }
    if (needsOrgHandleReview) {
      console.log('3) Confirm your personal organization handle is unique.');
    }
    if (!needsTermsAcceptance && !needsOrgHandleReview) {
      console.log('2) Confirm your account setup values.');
    }
  }
  console.log(`Login successful. Credentials saved to ${await getConfigPath()}`);
  scheduleSuccessfulLoginExitInsurance();
}

function scheduleSuccessfulLoginExitInsurance(): void {
  const timer = setTimeout(() => {
    process.exit(0);
  }, SUCCESSFUL_LOGIN_EXIT_INSURANCE_MS);
  timer.unref();
}
