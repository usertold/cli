// Single source of truth for legal-document versioning.
//
// Two constants, two jobs:
//
// ACTIVE_TERMS_VERSION — the version users accept and the one stamped on
// `users.terms_accepted_version`. Bump it whenever the substantive content of
// src/shared/content/legal/{terms,privacy,dpa}.md changes. The guard in
// src/backend/legal-docs.test.ts will fail until you also:
//   1. update the "(consent version YYYY-MM-DD)" line in the docs to match, and
//   2. refresh EXPECTED_LEGAL_FINGERPRINT in that test (the failure prints it).
// A bump here does NOT interrupt existing users: they get a dismissible
// "terms updated" notice (TermsUpdateNotice) per the Terms "Changes" clause
// notice-and-continue model. New acceptances always record ACTIVE.
//
// REQUIRED_TERMS_VERSION — the minimum accepted version that keeps an account
// out of the blocking onboarding gate. Anyone below it must affirmatively
// re-accept before using the app (web onboarding or `usertold auth terms
// accept`). Bump it RARELY, only for changes where continued use is weak
// evidence of assent:
//   - new prices or billing mechanics
//   - dispute-resolution / governing-law / arbitration changes
//   - materially expanded data use
//   - liability or warranty changes against the user
// Must always be <= ACTIVE_TERMS_VERSION (enforced by legal-docs.test.ts).
// Versions are ISO dates, so plain string comparison orders them correctly.
export const ACTIVE_TERMS_VERSION = '2026-08-20';
export const REQUIRED_TERMS_VERSION = '2026-08-20';

/** True when the account must affirmatively (re-)accept before using the app. */
export function needsTermsAcceptance(
  acceptedVersion: string | null,
  requiredVersion: string = REQUIRED_TERMS_VERSION,
): boolean {
  return !acceptedVersion || acceptedVersion < requiredVersion;
}

/**
 * True when the accepted version satisfies the blocking gate but is older than
 * the active docs — drives the dismissible terms-update notice.
 */
export function isTermsUpdateAvailable(
  acceptedVersion: string | null,
  activeVersion: string = ACTIVE_TERMS_VERSION,
  requiredVersion: string = REQUIRED_TERMS_VERSION,
): boolean {
  return acceptedVersion !== null
    && acceptedVersion >= requiredVersion
    && acceptedVersion < activeVersion;
}
