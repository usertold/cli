const CANONICAL_WIDGET_EMBED_ORIGIN = 'https://usertold.ai';
const CANONICAL_WIDGET_ASSET_ORIGIN = 'https://assets.usertold.ai';
const LEGACY_PRODUCTION_APP_ORIGIN = 'https://app.usertold.ai';

export const PROJECT_WIDGET_EMBED_GUIDANCE = "Install this Project script once across the site. Visibility selects one active Study for the current pathname and widget language; that Study's Invitation defines the launcher. One Project can contain many active Studies.";

export interface ProjectWidgetEmbedDetails {
  snippet: string;
  public_key: string;
  base_url: string;
  install_once: true;
  study_ref_required: false;
  guidance: typeof PROJECT_WIDGET_EMBED_GUIDANCE;
}

export function resolveWidgetEmbedOriginForEnvironment(env: string): string {
  switch (env) {
    case 'production':
      return CANONICAL_WIDGET_EMBED_ORIGIN;
    case 'stage':
    case 'staging':
      return 'https://usertold-stage.krasnoperov.me';
    case 'local':
      return 'https://local.krasnoperov.me:3001';
    default:
      throw new Error(`Unknown environment "${env}". Valid options: production, stage, local`);
  }
}

export function resolveWidgetAssetOriginForEnvironment(env: string): string {
  switch (env) {
    case 'production':
      return CANONICAL_WIDGET_ASSET_ORIGIN;
    case 'stage':
    case 'staging':
      return 'https://assets-stage.usertold.ai';
    case 'local':
      return resolveWidgetEmbedOriginForEnvironment(env);
    default:
      throw new Error(`Unknown environment "${env}". Valid options: production, stage, local`);
  }
}

export function resolveWidgetEmbedOrigin(currentOrigin?: string): string {
  if (!currentOrigin) {
    return CANONICAL_WIDGET_EMBED_ORIGIN;
  }

  try {
    const normalizedOrigin = new URL(currentOrigin).origin;
    if (normalizedOrigin === LEGACY_PRODUCTION_APP_ORIGIN) {
      return CANONICAL_WIDGET_EMBED_ORIGIN;
    }

    return normalizedOrigin;
  } catch {
    return CANONICAL_WIDGET_EMBED_ORIGIN;
  }
}

export function buildWidgetScriptSrc(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/v1/widget.js`;
}

/**
 * The customer embed: a one-line tag pointing at `/v1/widget.js`, which is
 * the tiny (~0.6KB) self-deferring loader (see src/widget/loader-entry.ts).
 * It injects the real bundle from its versioned asset URL only after `window.load`
 * at background priority, so the widget never competes with the host page's
 * critical render path — no integrator-side work required.
 */
export function buildWidgetEmbedSnippet(params: {
  origin: string;
  projectKey: string;
  async?: boolean;
}): string {
  const attrs = [
    params.async ? 'async' : null,
    `src="${buildWidgetScriptSrc(params.origin)}"`,
    `data-project-key="${params.projectKey}"`,
  ].filter(Boolean);

  return `<script ${attrs.join(' ')}></script>`;
}

export function buildProjectWidgetEmbedDetails(params: {
  origin: string;
  projectKey: string;
}): ProjectWidgetEmbedDetails {
  return {
    snippet: buildWidgetEmbedSnippet({
      async: true,
      origin: params.origin,
      projectKey: params.projectKey,
    }),
    public_key: params.projectKey,
    base_url: params.origin,
    install_once: true,
    study_ref_required: false,
    guidance: PROJECT_WIDGET_EMBED_GUIDANCE,
  };
}

export {
  CANONICAL_WIDGET_ASSET_ORIGIN,
  CANONICAL_WIDGET_EMBED_ORIGIN,
  LEGACY_PRODUCTION_APP_ORIGIN,
};
