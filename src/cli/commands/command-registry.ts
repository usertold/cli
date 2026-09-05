export type RegistryOperation = 'read' | 'write' | 'delete';
export type RegistryAuth = 'required' | 'optional' | 'none';

export type RegistryPositional = { name: string; required: boolean; description: string };
export type RegistryOptionRef = string | {
  name: string;
  type?: 'boolean' | 'string' | 'integer' | 'number' | 'enum' | 'json';
  values?: string[];
  description?: string;
  aliases?: string[];
};
export type RegistryLeaf = {
  summary: string;
  usage?: string;
  positionals: RegistryPositional[];
  options: RegistryOptionRef[];
  requiredOptions: string[];
  examples: string[];
  operation: RegistryOperation;
  auth: RegistryAuth;
  pagination?: { style: 'limit_offset'; parameters: ['limit', 'offset'] };
  destructive?: boolean;
};
export type RegistryCommand =
  | ({ kind: 'command' } & RegistryLeaf)
  | { kind: 'group'; summary: string; subcommands: Record<string, RegistryLeaf> };

export const COMMAND_REGISTRY: Record<string, RegistryCommand> =
{
  "auth": {
    "kind": "group",
    "summary": "Authenticate and inspect the current CLI session.",
    "subcommands": {
      "login": {
        "summary": "Sign in using OAuth or a provided token.",
        "positionals": [],
        "options": [
          "token",
          "no-browser",
          "port"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold auth login --help"
        ],
        "operation": "write",
        "auth": "none"
      },
      "logout": {
        "summary": "Remove stored CLI credentials.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold auth logout --help"
        ],
        "operation": "write",
        "auth": "none"
      },
      "whoami": {
        "summary": "Show the authenticated profile and organization handles.",
        "positionals": [],
        "options": [
          "no-verify"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold auth whoami --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "token": {
        "summary": "Print the active access token metadata.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold auth token --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "terms": {
        "summary": "Review Terms of Service acceptance status, or accept the latest Terms.",
        "positionals": [
          {
            "name": "action",
            "required": false,
            "description": "Optional action: accept, review, or status."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold auth terms",
          "usertold auth terms accept"
        ],
        "operation": "write",
        "auth": "required"
      },
      "browser-session": {
        "summary": "Mint short-lived browser credentials for Playwright or shell automation.",
        "positionals": [],
        "options": [
          { "name": "format", "type": "enum", "values": ["storage", "env", "cookie", "jwt"], "description": "Credential format: Playwright storage state, environment assignment, cookie, or raw JWT." },
          "token",
          { "name": "base-url", "description": "Override the UserTold app origin." },
          "output"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold auth browser-session --output storage-state.json",
          "usertold auth browser-session --format env"
        ],
        "operation": "write",
        "auth": "required"
      }
    }
  },
  "project": {
    "kind": "group",
    "summary": "Create, inspect, configure, select, and embed UserTold projects.",
    "subcommands": {
      "list": {
        "summary": "List projects in an organization.",
        "positionals": [
          {
            "name": "orgHandle",
            "required": false,
            "description": "Organization handle. Falls back to your personal org when omitted."
          }
        ],
        "options": [
          "org"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold project list --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "use": {
        "summary": "Select the current project for subsequent commands.",
        "positionals": [
          {
            "name": "projectRef",
            "required": true,
            "description": "Canonical org/project ref, for example acme/checkout."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project use --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "current": {
        "summary": "Show the currently selected project.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project current --help"
        ],
        "operation": "read",
        "auth": "none"
      },
      "create": {
        "summary": "Create a project.",
        "positionals": [
          {
            "name": "orgHandle",
            "required": false,
            "description": "Organization handle. Falls back to your personal org when omitted."
          }
        ],
        "options": [
          "name",
          "handle",
          "description",
          "org"
        ],
        "requiredOptions": [
          "name"
        ],
        "examples": [
          "usertold project create --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "get": {
        "summary": "Get project details.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project get --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "update": {
        "summary": "Update project metadata.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "name",
          "handle",
          "description"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold project update --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete a project.",
        "positionals": [
          {
            "name": "projectRef",
            "required": true,
            "description": "Canonical org/project ref, for example acme/checkout."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "snippet": {
        "summary": "Print the Project-owned install-once widget snippet.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project snippet acme/checkout"
        ],
        "operation": "read",
        "auth": "required"
      },
      "verify-widget-installation": {
        "summary": "Check an exact public page for the widget loader, Project key, CSP, and Permissions-Policy.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "url"
        ],
        "requiredOptions": [
          "url"
        ],
        "examples": [
          "usertold project verify-widget-installation acme/checkout --url https://example.com --json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "status": {
        "summary": "Show project readiness and signal health.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project status --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "overview": {
        "summary": "Show the project dashboard summary.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold project overview --help"
        ],
        "operation": "read",
        "auth": "required"
      }
    }
  },
  "interview": {
    "kind": "group",
    "summary": "Capture, import, inspect, download, reprocess, and watch interviews.",
    "subcommands": {
      "list": {
        "summary": "List interviews.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "status",
          "study",
          "limit",
          "offset",
          "processing-status"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview list --help"
        ],
        "operation": "read",
        "auth": "required",
        "pagination": {
          "style": "limit_offset",
          "parameters": [
            "limit",
            "offset"
          ]
        }
      },
      "create": {
        "summary": "Create a manual interview.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "name",
          "email",
          "mode"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview create --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "upload-video": {
        "summary": "Upload a local audio or video file, including iOS MOV, directly to R2 for asynchronous interview processing.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "file",
            "required": false,
            "description": "Path to a local audio or video recording file (up to 20GB). Required unless --audio is used."
          }
        ],
        "options": [
          "name",
          "email",
          "study",
          "content-type",
          "audio",
          "video",
          "audio-content-type",
          "video-content-type"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview upload-video --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "import-transcript": {
        "summary": "Import a local transcript file and queue evidence extraction.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "file",
            "required": true,
            "description": "Path to a local transcript text file."
          }
        ],
        "options": [
          "name",
          "email",
          "study",
          "content-type",
          "wait",
          "timeout"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview import-transcript --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "get": {
        "summary": "Get interview details.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview get --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "status": {
        "summary": "Get interview processing status.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview status --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "update": {
        "summary": "Update interview metadata.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "status",
          "summary"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview update --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete an interview.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "transcript": {
        "summary": "Print the interview transcript.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "raw"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview transcript --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "timeline": {
        "summary": "Print the interview timeline.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview timeline --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "enriched-timeline": {
        "summary": "Print timeline entries with extracted evidence context.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview enriched-timeline --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "media": {
        "summary": "Download or inspect merged interview media.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold interview media --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "audio": {
        "summary": "Download interview audio.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "output"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview audio --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "screen": {
        "summary": "Download screen recording media.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "output"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview screen --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "reprocess": {
        "summary": "Re-run extraction for an interview.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "wait",
          "timeout"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview reprocess --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "watch": {
        "summary": "Watch processing progress.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "interviewId",
            "required": true,
            "description": "Interview ID."
          }
        ],
        "options": [
          "timeout",
          "interval",
          "verbose",
          {
            "name": "evidence",
            "type": "boolean",
            "description": "Include newly extracted Evidence while watching processing. After completion, review suggested Findings with `usertold findings list --interview <interviewRef>`."
          }
        ],
        "requiredOptions": [],
        "examples": [
          "usertold interview watch --help"
        ],
        "operation": "read",
        "auth": "required"
      }
    }
  },
  "evidence": {
    "kind": "group",
    "summary": "Inspect and curate extracted research evidence.",
    "subcommands": {
      "list": {
        "summary": "List evidence, excluding dismissed evidence by default.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "type",
          "target-surface",
          "interview",
          "finding",
          "search",
          "limit",
          "offset",
          "min-confidence",
          "dismissed",
          "all"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold evidence list --help"
        ],
        "operation": "read",
        "auth": "required",
        "pagination": {
          "style": "limit_offset",
          "parameters": [
            "limit",
            "offset"
          ]
        }
      },
      "coverage-gaps": {
        "summary": "Show Evidence-to-Finding coverage gaps.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence coverage-gaps --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "get": {
        "summary": "Get evidence card details.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence get --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "case-file": {
        "summary": "Print the Evidence Case File V1 artifact for one evidence card.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence case-file --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "annotate": {
        "summary": "Add a human annotation to an evidence card.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [
          "text"
        ],
        "requiredOptions": [
          "text"
        ],
        "examples": [
          "usertold evidence annotate --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "dismiss": {
        "summary": "Soft-exclude an evidence card with a reason.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [
          "reason"
        ],
        "requiredOptions": [
          "reason"
        ],
        "examples": [
          "usertold evidence dismiss --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "undismiss": {
        "summary": "Restore a dismissed evidence card.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence undismiss --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "link": {
        "summary": "Link an Evidence card to a Finding.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence link --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "unlink": {
        "summary": "Unlink an Evidence card from its Finding.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence unlink --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete an evidence card (soft delete; recoverable).",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "evidenceId",
            "required": true,
            "description": "Evidence card ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold evidence delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "bulk-link": {
        "summary": "Link multiple Evidence cards to one Finding.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference to link the Evidence to."
          }
        ],
        "options": [
          "evidence"
        ],
        "requiredOptions": [
          "evidence"
        ],
        "examples": [
          "usertold evidence bulk-link --help"
        ],
        "operation": "write",
        "auth": "required"
      }
    }
  },
  "findings": {
    "kind": "group",
    "summary": "Review Evidence-backed Findings and hand reviewed Findings to product triage.",
    "subcommands": {
      "list": {
        "summary": "List Findings, optionally filtered by lifecycle, Interview, surface, or priority.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          {
            "name": "status",
            "type": "enum",
            "values": ["backlog", "ready", "in_progress", "done", "wont_fix"],
            "description": "Finding lifecycle filter. `ready` means reviewed and not yet sent."
          },
          "target-surface",
          "interview",
          "min-priority",
          "limit",
          "offset"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold findings list --status ready --json",
          "usertold findings list --interview int_123 --json"
        ],
        "operation": "read",
        "auth": "required",
        "pagination": {
          "style": "limit_offset",
          "parameters": [
            "limit",
            "offset"
          ]
        }
      },
      "get": {
        "summary": "Get a Finding with linked Evidence and lifecycle, relation, recurrence, and decision context.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold findings get acme/checkout fnd_123 --json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "create": {
        "summary": "Create an unlinked draft Finding; attach supporting Evidence before review.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "title",
          "description",
          "effort",
          "priority"
        ],
        "requiredOptions": [
          "title"
        ],
        "examples": [
          "usertold findings create --title \"Checkout confirmation is unclear\""
        ],
        "operation": "write",
        "auth": "required"
      },
      "create-from-evidence": {
        "summary": "Create a draft Finding from selected supporting Evidence.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "title",
          "evidence",
          "description"
        ],
        "requiredOptions": [
          "title",
          "evidence"
        ],
        "examples": [
          "usertold findings create-from-evidence --title \"Checkout confirmation is unclear\" --evidence evd_123,evd_456"
        ],
        "operation": "write",
        "auth": "required"
      },
      "update": {
        "summary": "Edit a Finding or move it through its review and delivery lifecycle.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [
          "title",
          "description",
          {
            "name": "status",
            "type": "enum",
            "values": ["backlog", "ready", "in_progress", "done", "wont_fix"],
            "description": "Finding lifecycle value. Use `ready` only after reviewing its supporting Evidence."
          },
          "effort",
          "priority"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold findings update acme/checkout fnd_123 --status ready --priority 80 --effort m"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete a Finding.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold findings delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "push": {
        "summary": "Send a reviewed Finding to the configured product-triage provider.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [
          {
            "name": "provider",
            "type": "enum",
            "values": ["auto", "github", "linear"],
            "description": "Omit or use `auto` for dashboard-configured selection; use `github` or `linear` as an explicit override."
          }
        ],
        "requiredOptions": [],
        "examples": [
          "usertold findings push acme/checkout fnd_123",
          "usertold findings push acme/checkout fnd_123 --provider linear"
        ],
        "operation": "write",
        "auth": "required"
      },
      "push-status": {
        "summary": "Inspect provider links and delivery status for a Finding.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "findingRef",
            "required": true,
            "description": "Opaque Finding reference returned by the API."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold findings push-status acme/checkout fnd_123 --json"
        ],
        "operation": "read",
        "auth": "required"
      }
    }
  },
  "intake": {
    "kind": "group",
    "summary": "Manage intakes and participant qualification responses.",
    "subcommands": {
      "list": {
        "summary": "List intakes.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold intake list --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "create": {
        "summary": "Create an intake.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "title",
          "handle",
          "description",
          "welcome-message",
          "consent-text",
          "brand-color",
          "max-participants",
          "questions",
          "activate"
        ],
        "requiredOptions": [
          "title"
        ],
        "examples": [
          "usertold intake create --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "get": {
        "summary": "Get intake details.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold intake get --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "update": {
        "summary": "Update intake fields.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          }
        ],
        "options": [
          "title",
          "description",
          "status",
          "welcome-message",
          "thank-you-message",
          "disqualified-message",
          "brand-color",
          "consent-text",
          "max-participants"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold intake update --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete an intake.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold intake delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "set-questions": {
        "summary": "Replace the intake question set.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          }
        ],
        "options": [
          "questions"
        ],
        "requiredOptions": [
          "questions"
        ],
        "examples": [
          "usertold intake set-questions --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "list-responses": {
        "summary": "List intake responses.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold intake list-responses --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "get-response": {
        "summary": "Get a single intake response.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          },
          {
            "name": "responseId",
            "required": true,
            "description": "Intake response ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold intake get-response --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "qualify-response": {
        "summary": "Mark an intake response as qualified.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          },
          {
            "name": "responseId",
            "required": true,
            "description": "Intake response ID."
          }
        ],
        "options": [
          "reason"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold intake qualify-response --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "disqualify-response": {
        "summary": "Mark an intake response as disqualified.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "intakeRef",
            "required": true,
            "description": "Intake handle."
          },
          {
            "name": "responseId",
            "required": true,
            "description": "Intake response ID."
          }
        ],
        "options": [
          "reason"
        ],
        "requiredOptions": [
          "reason"
        ],
        "examples": [
          "usertold intake disqualify-response --help"
        ],
        "operation": "write",
        "auth": "required"
      }
    }
  },
  "study": {
    "kind": "group",
    "summary": "Create, validate, import, export, and manage studies.",
    "subcommands": {
      "resolve": {
        "summary": "Preview autonomous Study ranking. Exclusions, route specificity, and language specificity apply first; higher Priority and then lower Project order win. A final tie fails closed. Language defaults to en; runtime availability is checked separately.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref. Falls back to the current project."
          }
        ],
        "options": [
          "path",
          "language"
        ],
        "requiredOptions": [
          "path"
        ],
        "examples": [
          "usertold study resolve acme/checkout --path /checkout/confirm --language de",
          "usertold study resolve acme/checkout --path /checkout/confirm --language de --json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "list": {
        "summary": "List studies.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold study list --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "create": {
        "summary": "Create a study.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "title",
          "handle",
          "description",
          "intake",
          "goals",
          "script",
          "allowed-origins",
          {
            "name": "activate",
            "type": "boolean",
            "description": "Activate the Study immediately after creation and begin matching eligible participants."
          },
          "invitation",
          "visibility"
        ],
        "requiredOptions": [
          "title"
        ],
        "examples": [
          "usertold study create acme/checkout --title \"Checkout feedback\" --invitation @invitation.json --visibility @visibility-v1.json"
        ],
        "operation": "write",
        "auth": "required"
      },
      "get": {
        "summary": "Get study details.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold study get acme/checkout checkout-feedback --json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "update": {
        "summary": "Update study fields.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [
          "title",
          "handle",
          "description",
          {
            "name": "status",
            "type": "enum",
            "values": ["draft", "active", "paused", "closed"],
            "description": "Study lifecycle status. Setting `active` begins matching eligible participants."
          },
          "intake",
          "goals",
          "script",
          "allowed-origins",
          "invitation",
          "visibility"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold study update acme/checkout checkout-feedback --invitation @invitation.json --visibility @visibility-v1.json",
          "usertold study update acme/checkout checkout-feedback --invitation @direct-link-invitation.json --json",
          "usertold study update acme/checkout checkout-feedback --invitation null --visibility null"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete a study.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold study delete --help"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      },
      "export": {
        "summary": "Export a study definition.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold study export --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "import": {
        "summary": "Import a study definition.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [
          "script"
        ],
        "requiredOptions": [
          "script"
        ],
        "examples": [
          "usertold study import --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "validate-script": {
        "summary": "Review a proposed script for an existing Study without updating it.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          },
          {
            "name": "studyRef",
            "required": true,
            "description": "Study handle."
          }
        ],
        "options": [
          "script"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold study validate-script acme/checkout checkout-feedback --script @study-script.json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "guide": {
        "summary": "Print study authoring guidance.",
        "positionals": [],
        "options": [
          "section"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold study guide --help"
        ],
        "operation": "read",
        "auth": "none"
      }
    }
  },
  "billing": {
    "kind": "group",
    "summary": "Inspect prepaid balance and interview billing.",
    "subcommands": {
      "status": {
        "summary": "Show prepaid balance and current rates.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold billing status --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "history": {
        "summary": "List recent billing events.",
        "positionals": [],
        "options": [
          "limit",
          "offset"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold billing history --help"
        ],
        "operation": "read",
        "auth": "required",
        "pagination": {
          "style": "limit_offset",
          "parameters": [
            "limit",
            "offset"
          ]
        }
      },
      "interviews": {
        "summary": "List interview charges, exclusions, and refunds.",
        "positionals": [],
        "options": [
          "limit",
          "offset"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold billing interviews --limit 50 --json"
        ],
        "operation": "read",
        "auth": "required",
        "pagination": {
          "style": "limit_offset",
          "parameters": [
            "limit",
            "offset"
          ]
        }
      }
    }
  },
  "export": {
    "kind": "group",
    "summary": "Create and download self-service data export bundles.",
    "subcommands": {
      "start": {
        "summary": "Queue a self-service data export.",
        "positionals": [],
        "options": [
          "wait",
          "output"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold export start --help"
        ],
        "operation": "write",
        "auth": "required"
      },
      "list": {
        "summary": "List recent data export jobs.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold export list --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "status": {
        "summary": "Show data export job status.",
        "positionals": [
          {
            "name": "exportJobId",
            "required": true,
            "description": "Data export job ID."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold export status --help"
        ],
        "operation": "read",
        "auth": "required"
      },
      "download": {
        "summary": "Download a completed data export bundle.",
        "positionals": [
          {
            "name": "exportJobId",
            "required": true,
            "description": "Data export job ID."
          }
        ],
        "options": [
          "output"
        ],
        "requiredOptions": [],
        "examples": [
          "usertold export download --help"
        ],
        "operation": "read",
        "auth": "required"
      }
    }
  },
  "init": {
    "kind": "command",
    "summary": "Bootstrap a Project and optionally create and activate an all-pages Study with its Intake.",
    "usage": "usertold init [options]",
    "positionals": [],
    "options": [
      "org",
      "name",
      "openai-key",
      "study-title",
      {
        "name": "yes",
        "description": "Skip prompts; create and activate the default all-pages Study and its Intake.",
        "aliases": [
          "y"
        ]
      }
    ],
    "requiredOptions": [
      "name"
    ],
    "examples": [
      "usertold init --org acme --name \"Demo\" --yes --json"
    ],
    "operation": "write",
    "auth": "required"
  },
  "completions": {
    "kind": "group",
    "summary": "Generate shell completion scripts.",
    "subcommands": {
      "bash": {
        "summary": "bash completions.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold completions bash --help"
        ],
        "operation": "read",
        "auth": "none"
      },
      "zsh": {
        "summary": "zsh completions.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold completions zsh --help"
        ],
        "operation": "read",
        "auth": "none"
      },
      "fish": {
        "summary": "fish completions.",
        "positionals": [],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold completions fish --help"
        ],
        "operation": "read",
        "auth": "none"
      }
    }
  },
  "organization": {
    "kind": "group",
    "summary": "Create and fully manage UserTold organizations (workspaces).",
    "subcommands": {
      "list": {
        "summary": "List organizations available to the current user.", "positionals": [], "options": [], "requiredOptions": [],
        "examples": ["usertold organization list --json"], "operation": "read", "auth": "required"
      },
      "create": {
        "summary": "Create an organization.", "positionals": [], "options": ["name", "handle"], "requiredOptions": ["name", "handle"],
        "examples": ["usertold organization create --name \"Acme\" --handle acme"], "operation": "write", "auth": "required"
      },
      "participants": {
        "summary": "List organization participants and their project access.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": [], "requiredOptions": [], "examples": ["usertold organization participants acme --json"], "operation": "read", "auth": "required"
      },
      "update-participant": {
        "summary": "Update a participant role and project access.",
        "positionals": [
          { "name": "orgHandle", "required": true, "description": "Organization handle." },
          { "name": "userId", "required": true, "description": "Participant user ID." }
        ],
        "options": ["role", "access", "projects"], "requiredOptions": ["role"],
        "examples": ["usertold organization update-participant acme 42 --role member --access selected --projects prj_one,prj_two"],
        "operation": "write", "auth": "required"
      },
      "remove-participant": {
        "summary": "Remove a participant from an organization.",
        "positionals": [
          { "name": "orgHandle", "required": true, "description": "Organization handle." },
          { "name": "userId", "required": true, "description": "Participant user ID." }
        ],
        "options": [], "requiredOptions": [], "examples": ["usertold organization remove-participant acme 42"],
        "operation": "delete", "auth": "required", "destructive": true
      },
      "invitations": {
        "summary": "List pending organization invitations.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": [], "requiredOptions": [], "examples": ["usertold organization invitations acme --json"], "operation": "read", "auth": "required"
      },
      "invite": {
        "summary": "Invite a person with a role and project access.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": ["email", "role", "access", "projects"], "requiredOptions": ["email", "role"],
        "examples": ["usertold organization invite acme --email teammate@example.com --role member --access all"],
        "operation": "write", "auth": "required"
      },
      "share-project": {
        "summary": "Invite a person to one project.",
        "positionals": [{ "name": "projectRef", "required": true, "description": "Canonical org/project ref." }],
        "options": ["email"], "requiredOptions": ["email"],
        "examples": ["usertold organization share-project acme/checkout --email teammate@example.com"],
        "operation": "write", "auth": "required"
      },
      "resend-invitation": {
        "summary": "Resend an organization invitation.",
        "positionals": [
          { "name": "orgHandle", "required": true, "description": "Organization handle." },
          { "name": "invitationId", "required": true, "description": "Invitation ID." }
        ],
        "options": [], "requiredOptions": [], "examples": ["usertold organization resend-invitation acme inv_123"],
        "operation": "write", "auth": "required"
      },
      "revoke-invitation": {
        "summary": "Revoke an organization invitation.",
        "positionals": [
          { "name": "orgHandle", "required": true, "description": "Organization handle." },
          { "name": "invitationId", "required": true, "description": "Invitation ID." }
        ],
        "options": [], "requiredOptions": [], "examples": ["usertold organization revoke-invitation acme inv_123"],
        "operation": "delete", "auth": "required", "destructive": true
      },
      "inspect-invitation": {
        "summary": "Inspect an invitation token before signing in.", "positionals": [], "options": ["token"], "requiredOptions": ["token"],
        "examples": ["usertold organization inspect-invitation --token TOKEN --json"], "operation": "read", "auth": "none"
      },
      "accept-invitation": {
        "summary": "Accept an invitation into an organization.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle from the invitation." }],
        "options": ["token"], "requiredOptions": ["token"],
        "examples": ["usertold organization accept-invitation acme --token TOKEN"], "operation": "write", "auth": "required"
      }
    }
  },
  "settings": {
    "kind": "group",
    "summary": "Manage documented project settings without exposing arbitrary configuration.",
    "subcommands": {
      "show": {
        "summary": "Show masked project settings.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold settings show acme/checkout --json"], "operation": "read", "auth": "required"
      },
      "set": {
        "summary": "Set a documented project setting.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [{ "name": "key", "type": "enum", "values": ["openai_api_key", "retention_days"], "description": "Documented project setting." }, "value"],
        "requiredOptions": ["key", "value"],
        "examples": ["usertold settings set acme/checkout --key retention_days --value 90"], "operation": "write", "auth": "required"
      },
      "delete": {
        "summary": "Remove a documented project setting.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [{ "name": "key", "type": "enum", "values": ["openai_api_key", "retention_days"], "description": "Documented project setting." }],
        "requiredOptions": ["key"], "examples": ["usertold settings delete acme/checkout --key openai_api_key"],
        "operation": "delete", "auth": "required", "destructive": true
      },
      "validate": {
        "summary": "Validate a setting value before saving it.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [{ "name": "key", "type": "enum", "values": ["openai_api_key", "retention_days"], "description": "Documented project setting." }, "value"],
        "requiredOptions": ["key", "value"],
        "examples": ["usertold settings validate acme/checkout --key retention_days --value 90"], "operation": "write", "auth": "required"
      },
      "key-health": {
        "summary": "Check the configured OpenAI key health.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold settings key-health acme/checkout --json"], "operation": "read", "auth": "required"
      }
    }
  },
  "integration": {
    "kind": "group",
    "summary": "Connect and configure GitHub and Linear delivery integrations.",
    "subcommands": {
      "github-install-url": {
        "summary": "Print the authenticated-browser URL for installing the GitHub App.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-install-url acme/checkout"], "operation": "read", "auth": "required"
      },
      "github-installations": {
        "summary": "List GitHub App installations available to a project.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-installations acme/checkout --json"], "operation": "read", "auth": "required"
      },
      "github-repositories": {
        "summary": "List repositories available through the selected GitHub installation.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-repositories acme/checkout --json"], "operation": "read", "auth": "required"
      },
      "github-select-installation": {
        "summary": "Select a GitHub App installation for a project.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": ["installation-id"], "requiredOptions": ["installation-id"],
        "examples": ["usertold integration github-select-installation acme/checkout --installation-id 123"], "operation": "write", "auth": "required"
      },
      "github-select-repository": {
        "summary": "Select the GitHub repository that receives reviewed Findings.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": ["repo", "branch"], "requiredOptions": ["repo"],
        "examples": ["usertold integration github-select-repository acme/checkout --repo https://github.com/acme/app --branch main"], "operation": "write", "auth": "required"
      },
      "github-verify": {
        "summary": "Verify the selected GitHub integration.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-verify acme/checkout"], "operation": "write", "auth": "required"
      },
      "github-diagnostics": {
        "summary": "Show project-scoped GitHub integration diagnostics.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-diagnostics acme/checkout --json"], "operation": "read", "auth": "required"
      },
      "github-disconnect": {
        "summary": "Disconnect GitHub delivery from a project.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration github-disconnect acme/checkout"],
        "operation": "delete", "auth": "required", "destructive": true
      },
      "linear-connect-url": {
        "summary": "Print the authenticated-browser URL for connecting Linear.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": ["return-to"], "requiredOptions": [], "examples": ["usertold integration linear-connect-url acme"], "operation": "read", "auth": "required"
      },
      "linear-status": {
        "summary": "Show an organization's Linear connection status.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration linear-status acme --json"], "operation": "read", "auth": "required"
      },
      "linear-teams": {
        "summary": "List Linear teams available to a project.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration linear-teams acme/checkout --json"], "operation": "read", "auth": "required"
      },
      "linear-select-team": {
        "summary": "Select the Linear team that receives reviewed Findings.",
        "positionals": [{ "name": "projectRef", "required": false, "description": "Canonical org/project ref; defaults to the selected project." }],
        "options": ["team-id"], "requiredOptions": ["team-id"],
        "examples": ["usertold integration linear-select-team acme/checkout --team-id TEAM_ID"], "operation": "write", "auth": "required"
      },
      "linear-disconnect": {
        "summary": "Disconnect Linear from an organization.",
        "positionals": [{ "name": "orgHandle", "required": true, "description": "Organization handle." }],
        "options": [], "requiredOptions": [], "examples": ["usertold integration linear-disconnect acme"],
        "operation": "delete", "auth": "required", "destructive": true
      }
    }
  },
  "knowledge": {
    "kind": "group",
    "summary": "Configure and test the project knowledge HTTP action.",
    "subcommands": {
      "show": {
        "summary": "Show the configured knowledge HTTP action with masked header values.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold knowledge show acme/checkout --json"
        ],
        "operation": "read",
        "auth": "required"
      },
      "apply": {
        "summary": "Create or replace the knowledge HTTP action from JSON.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "data"
        ],
        "requiredOptions": [
          "data"
        ],
        "examples": [
          "usertold knowledge apply acme/checkout --data @knowledge-action.json"
        ],
        "operation": "write",
        "auth": "required"
      },
      "test": {
        "summary": "Test a saved or draft knowledge HTTP action with example variables.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [
          "query",
          "page-url",
          "site-hostname",
          "data"
        ],
        "requiredOptions": [
          "query"
        ],
        "examples": [
          "usertold knowledge test acme/checkout --query \"What plans do you offer?\" --page-url https://example.com/pricing --site-hostname example.com",
          "usertold knowledge test acme/checkout --query \"What plans do you offer?\" --data @knowledge-action.json --json"
        ],
        "operation": "write",
        "auth": "required"
      },
      "delete": {
        "summary": "Delete the configured knowledge HTTP action.",
        "positionals": [
          {
            "name": "projectRef",
            "required": false,
            "description": "Canonical org/project ref, for example acme/checkout. Falls back to the current project set via `usertold project use`."
          }
        ],
        "options": [],
        "requiredOptions": [],
        "examples": [
          "usertold knowledge delete acme/checkout"
        ],
        "operation": "delete",
        "auth": "required",
        "destructive": true
      }
    }
  }
};
