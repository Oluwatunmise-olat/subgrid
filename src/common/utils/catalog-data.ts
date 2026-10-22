import type {
	BridgePreset,
	CatalogCategory,
	CatalogIntegration,
} from '@/common/types/catalog';

export type {
	AuthSpec,
	BridgePreset,
	CatalogCategory,
	CatalogField,
	CatalogIntegration,
	FieldType,
	RestVerb,
	VerbParam,
} from '@/common/types/catalog';

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  "storage": "Storage",
  "paas": "Compute / PaaS",
  "dns": "DNS / Edge",
  "email": "Email",
  "database": "Database",
  "other": "Other"
};

export const INTEGRATIONS: CatalogIntegration[] = [
  {
    "id": "digitalocean",
    "official": true,
    "name": "DigitalOcean",
    "category": "paas",
    "description": "Manage DigitalOcean apps, droplets and databases via DigitalOcean's official MCP server",
    "command": "npx",
    "baseArgs": [
      "-y",
      "@digitalocean/mcp",
      "--services",
      "apps,droplets,databases"
    ],
    "fields": [
      {
        "key": "DIGITALOCEAN_API_TOKEN",
        "label": "API token",
        "type": "password",
        "help": "DigitalOcean → API → Tokens. Grant only the scopes needed for the services you enable."
      }
    ],
    "docs": {
      "label": "DigitalOcean MCP documentation",
      "url": "https://docs.digitalocean.com/reference/mcp/"
    },
    "steps": [
      "Create a DigitalOcean personal access token with the minimum required scopes.",
      "Use a token with write access only if you intend to create or change resources."
    ]
  },
  {
    "id": "resend",
    "official": true,
    "name": "Resend",
    "category": "email",
    "description": "Send email via the Resend API — published by Resend (resend-mcp)",
    "command": "npx",
    "baseArgs": [
      "-y",
      "resend-mcp"
    ],
    "fields": [
      {
        "key": "RESEND_API_KEY",
        "label": "API key",
        "placeholder": "re_xxxxxxxxx",
        "type": "password",
        "help": "Resend → API Keys → create a key with sending permission."
      },
      {
        "key": "SENDER_EMAIL_ADDRESS",
        "label": "Sender email",
        "placeholder": "you@yourdomain.com (must be verified in Resend)",
        "type": "text",
        "help": "The \"from\" address — it must be on a domain you've verified in Resend → Domains."
      }
    ],
    "docs": {
      "label": "Resend → API Keys",
      "url": "https://resend.com/api-keys"
    },
    "steps": [
      "Resend → API Keys → create a key with sending permission.",
      "Verify a domain in Resend → Domains, then use a sender address on that domain."
    ]
  },
  {
    "id": "resend-oauth",
    "official": true,
    "name": "Resend (hosted)",
    "category": "email",
    "description": "Resend's hosted server — sign in with Resend, no API key to paste",
    "transport": "http",
    "url": "https://mcp.resend.com/mcp",
    "oauth": true,
    "fields": []
  },
  {
    "id": "cloudflare-full",
    "official": true,
    "name": "Cloudflare",
    "category": "paas",
    "description": "DNS, R2, Workers, zones — Cloudflare's official hosted server (sign in with Cloudflare)",
    "transport": "http",
    "url": "https://mcp.cloudflare.com/mcp",
    "oauth": true,
    "fields": []
  },
  {
    "id": "sanity",
    "official": true,
    "name": "Sanity",
    "category": "database",
    "description": "Content ops via Sanity's official hosted MCP (sign in with Sanity)",
    "transport": "http",
    "url": "https://mcp.sanity.io",
    "oauth": true,
    "fields": []
  },
  {
    "id": "bridge",
    "firstParty": true,
    "name": "Vendor API",
    "category": "other",
    "description": "Our own bridge calling a vendor's documented REST API",
    "custom": "bridge",
    "fields": []
  },
  {
    "id": "custom-stdio",
    "name": "Custom (local command)",
    "category": "other",
    "description": "Any MCP server you run with a shell command — you are responsible for this code",
    "command": "",
    "baseArgs": [],
    "fields": [],
    "custom": "stdio"
  },
  {
    "id": "custom-remote",
    "name": "Custom (remote URL)",
    "category": "other",
    "description": "An MCP server reachable over SSE or HTTP",
    "url": "",
    "fields": [],
    "custom": "remote"
  }
];

export const BRIDGE_PRESETS: BridgePreset[] = [
  {
    "id": "cloudflare-dns",
    "kind": "rest",
    "name": "Cloudflare DNS",
    "category": "dns",
    "provider": "cloudflare-dns",
    "description": "List, create, update and delete DNS records in one zone",
    "docs": "https://developers.cloudflare.com/api/resources/dns/",
    "baseUrl": "https://api.cloudflare.com",
    "auth": {
      "header": "authorization",
      "value": "Bearer ${CLOUDFLARE_API_TOKEN}"
    },
    "fields": [
      {
        "key": "CLOUDFLARE_API_TOKEN",
        "label": "API token",
        "type": "password",
        "placeholder": "scoped to Zone → DNS → Edit",
        "help": "Cloudflare → My Profile → API Tokens → Create Token → Edit zone DNS. Scope it to one zone, not the account."
      },
      {
        "key": "CLOUDFLARE_ZONE_ID",
        "label": "Zone ID",
        "type": "text",
        "placeholder": "32-character hex id",
        "help": "Cloudflare → your domain → Overview → API → Zone ID. Not the domain name."
      }
    ],
    "verbs": [
      {
        "name": "list_zones",
        "method": "GET",
        "path": "/client/v4/zones",
        "description": "List the zones this token can see",
        "params": {
          "name": {
            "in": "query"
          },
          "page": {
            "type": "number",
            "in": "query"
          }
        }
      },
      {
        "name": "list_dns_records",
        "method": "GET",
        "path": "/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records",
        "description": "List DNS records for a domain in the configured zone",
        "params": {
          "type": {
            "in": "query"
          },
          "name": {
            "in": "query"
          },
          "content": {
            "in": "query"
          },
          "per_page": {
            "type": "number",
            "in": "query"
          }
        }
      },
      {
        "name": "create_dns_record",
        "method": "POST",
        "path": "/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records",
        "description": "Create a DNS record for a domain",
        "params": {
          "type": {
            "in": "body",
            "required": true,
            "description": "record type",
            "enum": [
              "A",
              "AAAA",
              "CNAME",
              "MX",
              "TXT",
              "NS",
              "SRV",
              "CAA",
              "PTR",
              "HTTPS",
              "SVCB",
              "TLSA",
              "SSHFP",
              "NAPTR",
              "URI",
              "LOC",
              "DS",
              "DNSKEY",
              "CERT",
              "OPENPGPKEY"
            ]
          },
          "name": {
            "in": "body",
            "required": true,
            "description": "hostname, e.g. secrets.example.com"
          },
          "content": {
            "in": "body",
            "required": true,
            "description": "the value, e.g. an IPv4 address"
          },
          "ttl": {
            "type": "number",
            "in": "body"
          },
          "proxied": {
            "type": "boolean",
            "in": "body"
          },
          "priority": {
            "type": "number",
            "in": "body"
          },
          "comment": {
            "in": "body"
          }
        }
      },
      {
        "name": "update_dns_record",
        "method": "PATCH",
        "path": "/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/{record_id}",
        "description": "Update one DNS record",
        "params": {
          "record_id": {
            "description": "record id from list_dns_records"
          },
          "content": {
            "in": "body"
          },
          "ttl": {
            "type": "number",
            "in": "body"
          },
          "proxied": {
            "type": "boolean",
            "in": "body"
          },
          "comment": {
            "in": "body"
          }
        }
      },
      {
        "name": "delete_dns_record",
        "method": "DELETE",
        "path": "/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/{record_id}",
        "description": "Delete one DNS record",
        "params": {
          "record_id": {
            "description": "record id from list_dns_records"
          }
        }
      }
    ]
  },
  {
    "id": "godaddy-dns",
    "kind": "rest",
    "name": "GoDaddy DNS",
    "category": "dns",
    "provider": "godaddy-dns",
    "description": "List domains and manage DNS records on GoDaddy nameservers",
    "docs": "https://developer.godaddy.com/en/docs/references/rest/domains/v1",
    "baseUrl": "https://api.godaddy.com",
    "auth": {
      "header": "authorization",
      "value": "sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}"
    },
    "fields": [
      {
        "key": "GODADDY_API_KEY",
        "label": "API key",
        "type": "password",
        "placeholder": "from developer.godaddy.com",
        "help": "GoDaddy → developer.godaddy.com → API Keys. The DNS API requires your account to qualify (10+ domains or a paid plan)."
      },
      {
        "key": "GODADDY_API_SECRET",
        "label": "API secret",
        "type": "password",
        "placeholder": "shown once when the key is created",
        "help": "Copy it when the key is created — GoDaddy only shows it once."
      },
      {
        "key": "GODADDY_DOMAIN",
        "label": "Domain",
        "type": "text",
        "placeholder": "example.com",
        "help": "The domain whose zone you want to manage. Must use GoDaddy's nameservers."
      }
    ],
    "verbs": [
      {
        "name": "list_domains",
        "method": "GET",
        "path": "/v1/domains",
        "description": "List domains owned by this account",
        "params": {
          "limit": {
            "type": "number",
            "in": "query"
          },
          "statuses": {
            "in": "query"
          }
        }
      },
      {
        "name": "list_dns_records",
        "method": "GET",
        "path": "/v1/domains/${GODADDY_DOMAIN}/records",
        "description": "List DNS records for the configured domain",
        "params": {
          "type": {
            "in": "query"
          },
          "name": {
            "in": "query"
          },
          "limit": {
            "type": "number",
            "in": "query"
          }
        }
      },
      {
        "name": "add_dns_record",
        "method": "PATCH",
        "path": "/v1/domains/${GODADDY_DOMAIN}/records",
        "description": "Add a DNS record (PATCH, body sent as a one-element array)",
        "bodyArray": true,
        "params": {
          "type": {
            "in": "body",
            "required": true
          },
          "name": {
            "in": "body",
            "required": true
          },
          "data": {
            "in": "body",
            "required": true
          },
          "ttl": {
            "type": "number",
            "in": "body"
          },
          "priority": {
            "type": "number",
            "in": "body"
          }
        }
      },
      {
        "name": "delete_dns_record",
        "method": "DELETE",
        "path": "/v1/domains/${GODADDY_DOMAIN}/records/{type}/{name}",
        "description": "Delete all records of a type at a name",
        "params": {
          "type": {
            "description": "e.g. A, CNAME, TXT"
          },
          "name": {
            "description": "record name, @ for the apex"
          }
        }
      }
    ]
  },
  {
    "id": "cloudflare-r2-s3",
    "kind": "s3",
    "name": "Cloudflare R2 (S3 API)",
    "category": "storage",
    "provider": "cloudflare-r2",
    "description": "Buckets and objects over the S3 API — per-component keys, no CLI, no login",
    "docs": "https://developers.cloudflare.com/r2/api/s3/api/",
    "endpoint": "${S3_ENDPOINT}",
    "region": "${S3_REGION}",
    "accessKeyId": "${S3_ACCESS_KEY_ID}",
    "secretAccessKey": "${S3_SECRET_ACCESS_KEY}",
    "fields": [
      {
        "key": "S3_ENDPOINT",
        "label": "Endpoint",
        "type": "text",
        "placeholder": "https://<account-id>.r2.cloudflarestorage.com",
        "help": "Cloudflare → R2 → Manage R2 API Tokens shows the S3 endpoint for your account."
      },
      {
        "key": "S3_ACCESS_KEY_ID",
        "label": "Access key ID",
        "type": "password",
        "placeholder": "from an R2 API token",
        "help": "Cloudflare → R2 → Manage R2 API Tokens → create a token with Object Read & Write, scoped to the buckets you want."
      },
      {
        "key": "S3_SECRET_ACCESS_KEY",
        "label": "Secret access key",
        "type": "password",
        "placeholder": "shown once when the token is created",
        "help": "Copy it when the token is created — Cloudflare only shows it once."
      },
      {
        "key": "S3_REGION",
        "label": "Region",
        "type": "text",
        "placeholder": "auto",
        "help": "R2 uses \"auto\". AWS S3 uses the bucket's own region."
      }
    ],
    "verbs": [
      {
        "name": "list_buckets"
      },
      {
        "name": "list_objects"
      },
      {
        "name": "head_object"
      },
      {
        "name": "get_object"
      },
      {
        "name": "put_object"
      },
      {
        "name": "delete_object"
      }
    ],
    "limits": "This uses the same S3 credentials your existing R2 component already stores — reuse them and the community server becomes redundant."
  },
{
  "id": "postmark",
  "kind": "rest",
  "name": "Postmark",
  "category": "email",
  "provider": "postmark",
  "description": "Inbound email, delivery, bounces and stats on one Postmark server",
  "docs": "https://postmarkapp.com/developer/api/messages-api",
  "baseUrl": "https://api.postmarkapp.com",
  "auth": {
    "header": "X-Postmark-Server-Token",
    "value": "${POSTMARK_SERVER_TOKEN}"
  },
  "fields": [
    {
      "key": "POSTMARK_SERVER_TOKEN",
      "label": "Server token",
      "type": "password",
      "placeholder": "from your Postmark server's API Tokens tab",
      "help": "Postmark \u2192 your server \u2192 API Tokens. The server token covers inbound search, sending, bounces and stats."
    }
  ],
  "verbs": [
    {
      "name": "search_inbound_messages",
      "method": "GET",
      "path": "/messages/inbound",
      "description": "Search received messages",
      "params": {
        "recipient": {
          "in": "query"
        },
        "fromemail": {
          "in": "query"
        },
        "subject": {
          "in": "query"
        },
        "tag": {
          "in": "query"
        },
        "mailboxhash": {
          "in": "query"
        },
        "status": {
          "in": "query",
          "enum": [
            "blocked",
            "processed",
            "queued",
            "failed",
            "scheduled"
          ]
        },
        "fromdate": {
          "in": "query"
        },
        "todate": {
          "in": "query"
        },
        "count": {
          "type": "number",
          "in": "query",
          "default": 20
        },
        "offset": {
          "type": "number",
          "in": "query",
          "default": 0
        }
      }
    },
    {
      "name": "get_inbound_message",
      "method": "GET",
      "path": "/messages/inbound/{message_id}/details",
      "description": "Full body, headers and attachments of one received message",
      "params": {
        "message_id": {
          "description": "MessageID from search_inbound_messages"
        }
      }
    },
    {
      "name": "retry_inbound_message",
      "method": "PUT",
      "path": "/messages/inbound/{message_id}/retry",
      "description": "Ask Postmark to reprocess a failed inbound message",
      "requiresApproval": true,
      "params": {
        "message_id": {
          "description": "MessageID from search_inbound_messages"
        }
      }
    },
    {
      "name": "search_outbound_messages",
      "method": "GET",
      "path": "/messages/outbound",
      "description": "Search messages sent through this server",
      "params": {
        "recipient": {
          "in": "query"
        },
        "tag": {
          "in": "query"
        },
        "status": {
          "in": "query"
        },
        "fromdate": {
          "in": "query"
        },
        "todate": {
          "in": "query"
        },
        "count": {
          "type": "number",
          "in": "query",
          "default": 20
        },
        "offset": {
          "type": "number",
          "in": "query",
          "default": 0
        }
      }
    },
    {
      "name": "list_bounces",
      "method": "GET",
      "path": "/bounces",
      "description": "Messages Postmark could not deliver, newest first",
      "params": {
        "count": {
          "type": "number",
          "in": "query",
          "default": 20
        },
        "offset": {
          "type": "number",
          "in": "query",
          "default": 0
        }
      }
    },
    {
      "name": "outbound_stats",
      "method": "GET",
      "path": "/stats/outbound",
      "description": "Overview: sent, bounced, spam complaints and open and click rates"
    },
    {
      "name": "bounce_stats",
      "method": "GET",
      "path": "/stats/outbound/bounces",
      "description": "Bounce counts broken down by type"
    },
    {
      "name": "sent_counts",
      "method": "GET",
      "path": "/stats/outbound/sends",
      "description": "How many messages were sent"
    }
  ],
  "limits": "Every path here was confirmed against the live API. /server is deliberately not offered: it returns the server's API tokens, and tool results are persisted in the action log and passed to the model, so a 'connection check' would write a live credential into storage. Use list_bounces or outbound_stats as the health check instead. The bounce list is offered without filters, and the stats endpoints without a date range or tag, because those parameter names were not verified \u2014 each returns the vendor's default window rather than a guessed filter. Bounce dumps, bounce activation and the other per-metric stats endpoints were not probed, so they are not offered."
},
{
  "id": "coolify",
  "kind": "rest",
  "name": "Coolify",
  "category": "paas",
  "provider": "coolify",
  "description": "Applications, projects and servers on your own Coolify instance",
  "docs": "https://coolify.io/docs/api/overview",
  "baseUrl": "${COOLIFY_URL}",
  "auth": {
    "header": "authorization",
    "value": "Bearer ${COOLIFY_TOKEN}"
  },
  "fields": [
    {
      "key": "COOLIFY_URL",
      "label": "Instance URL",
      "type": "text",
      "placeholder": "https://coolify.example.com",
      "help": "Your Coolify instance with no trailing slash. It must be reachable from this machine."
    },
    {
      "key": "COOLIFY_TOKEN",
      "label": "API token",
      "type": "password",
      "placeholder": "from Keys & Tokens \u2192 API tokens",
      "help": "Coolify \u2192 Keys & Tokens \u2192 API tokens, with permission for what you want to do. A self-hosted instance must also have API access enabled."
    }
  ],
  "verbs": [
    {
      "name": "current_team",
      "method": "GET",
      "path": "/api/v1/teams/current",
      "description": "The team this token belongs to \u2014 a good connection check"
    },
    {
      "name": "list_applications",
      "method": "GET",
      "path": "/api/v1/applications",
      "description": "Applications"
    },
    {
      "name": "list_projects",
      "method": "GET",
      "path": "/api/v1/projects",
      "description": "Projects"
    },
    {
      "name": "list_servers",
      "method": "GET",
      "path": "/api/v1/servers",
      "description": "Servers Coolify manages"
    },
    {
      "name": "list_deployments",
      "method": "GET",
      "path": "/api/v1/deployments",
      "description": "Recent deployments",
      "params": {
        "uuid": {
          "in": "query"
        }
      }
    },
    {
      "name": "create_application_from_deploy_key",
      "method": "POST",
      "path": "/api/v1/applications/private-deploy-key",
      "description": "Create an application from a private git repository through a deploy key",
      "requiresApproval": true,
      "params": {
        "project_uuid": {
          "in": "body",
          "required": true,
          "description": "project UUID"
        },
        "server_uuid": {
          "in": "body",
          "required": true,
          "description": "server UUID"
        },
        "environment_name": {
          "in": "body",
          "required": true,
          "description": "environment name, e.g. production"
        },
        "environment_uuid": {
          "in": "body",
          "description": "use instead of environment_name if you know it"
        },
        "private_key_uuid": {
          "in": "body",
          "required": true,
          "description": "private key UUID from Coolify"
        },
        "git_repository": {
          "in": "body",
          "required": true,
          "description": "git repository URL"
        },
        "git_branch": {
          "in": "body",
          "required": true
        },
        "build_pack": {
          "in": "body",
          "required": true,
          "enum": [
            "nixpacks",
            "railpack",
            "static",
            "dockerfile",
            "dockercompose"
          ]
        },
        "name": {
          "in": "body",
          "description": "application name"
        },
        "domains": {
          "in": "body",
          "description": "application URLs as a comma-separated list"
        }
      }
    },
    {
      "name": "create_env",
      "method": "POST",
      "path": "/api/v1/applications/{uuid}/envs",
      "description": "Add an environment variable to an application",
      "requiresApproval": true,
      "params": {
        "uuid": {
          "description": "application UUID from list_applications"
        },
        "key": {
          "in": "body",
          "required": true,
          "description": "variable name"
        },
        "value": {
          "in": "body",
          "required": true,
          "description": "variable value"
        },
        "is_preview": {
          "type": "boolean",
          "in": "body"
        },
        "is_literal": {
          "type": "boolean",
          "in": "body",
          "description": "store the value without escaping"
        },
        "is_multiline": {
          "type": "boolean",
          "in": "body"
        },
        "is_shown_once": {
          "type": "boolean",
          "in": "body",
          "description": "hide the saved value in the UI and API responses"
        }
      }
    },
    {
      "name": "create_server_shared_env",
      "method": "POST",
      "path": "/api/v1/servers/{uuid}/envs",
      "description": "Add a shared environment variable to a server",
      "requiresApproval": true,
      "params": {
        "uuid": {
          "description": "server UUID from list_servers"
        },
        "key": {
          "in": "body",
          "required": true,
          "description": "variable name"
        },
        "value": {
          "in": "body",
          "required": true,
          "description": "variable value"
        },
        "is_preview": {
          "type": "boolean",
          "in": "body"
        },
        "is_literal": {
          "type": "boolean",
          "in": "body"
        },
        "is_multiline": {
          "type": "boolean",
          "in": "body"
        },
        "is_shown_once": {
          "type": "boolean",
          "in": "body"
        }
      }
    },
    {
      "name": "create_project_shared_env",
      "method": "POST",
      "path": "/api/v1/projects/{uuid}/envs",
      "description": "Add a shared environment variable to a project",
      "requiresApproval": true,
      "params": {
        "uuid": {
          "description": "project UUID from list_projects"
        },
        "key": {
          "in": "body",
          "required": true,
          "description": "variable name"
        },
        "value": {
          "in": "body",
          "required": true,
          "description": "variable value"
        },
        "is_preview": {
          "type": "boolean",
          "in": "body"
        },
        "is_literal": {
          "type": "boolean",
          "in": "body"
        },
        "is_multiline": {
          "type": "boolean",
          "in": "body"
        },
        "is_shown_once": {
          "type": "boolean",
          "in": "body"
        }
      }
    }
  ],
  "limits": "Applications are listed but not deployed \u2014 the deploy endpoint's path is not confirmed in Coolify's public docs, so it is not offered rather than guessed."
},
{
  "id": "contabo",
  "kind": "rest",
  "name": "Contabo",
  "category": "paas",
  "provider": "contabo",
  "description": "VPS and VDS instances on your Contabo account",
  "docs": "https://api.contabo.com/",
  "baseUrl": "https://api.contabo.com",
  "uniqueHeaders": [
    "x-request-id"
  ],
  "auth": {
    "oauth2": {
      "tokenUrl": "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token",
      "grantType": "password",
      "clientId": "${CONTABO_CLIENT_ID}",
      "clientSecret": "${CONTABO_CLIENT_SECRET}",
      "username": "${CONTABO_API_USER}",
      "password": "${CONTABO_API_PASSWORD}"
    }
  },
  "fields": [
    {
      "key": "CONTABO_CLIENT_ID",
      "label": "Client ID",
      "type": "password",
      "placeholder": "from my.contabo.com/api/details",
      "help": "Contabo \u2192 Customer Control Panel \u2192 API \u2192 ClientId."
    },
    {
      "key": "CONTABO_CLIENT_SECRET",
      "label": "Client secret",
      "type": "password",
      "placeholder": "from the same page",
      "help": "Shown alongside the ClientId."
    },
    {
      "key": "CONTABO_API_USER",
      "label": "API user",
      "type": "text",
      "placeholder": "the email you log into Contabo with",
      "help": "The email address for your Contabo account."
    },
    {
      "key": "CONTABO_API_PASSWORD",
      "label": "API password",
      "type": "password",
      "placeholder": "set separately under API settings",
      "help": "Not your login password. Contabo's API docs point at my.contabo.com/api/details for setting it; their newer Security & Access page shows only Username, Client ID and Client Secret, so this value may have to come from the older panel."
    }
  ],
  "verbs": [
  {
    "name": "list_instances",
    "method": "GET",
    "path": "/v1/compute/instances",
    "description": "All VPS and VDS instances on the account",
    "params": {
      "name": {
        "in": "query"
      },
      "status": {
        "in": "query"
      },
      "search": {
        "in": "query"
      },
      "page": {
        "type": "number",
        "in": "query"
      },
      "size": {
        "type": "number",
        "in": "query"
      }
    }
  },
  {
    "name": "get_instance",
    "method": "GET",
    "path": "/v1/compute/instances/{instance_id}",
    "description": "One instance \u2014 IPs, region, product, status",
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "list_instance_audits",
    "method": "GET",
    "path": "/v1/compute/instances/audits",
    "description": "History of what happened to your instances",
    "params": {
      "page": {
        "type": "number",
        "in": "query"
      },
      "size": {
        "type": "number",
        "in": "query"
      }
    }
  },
  {
    "name": "list_snapshots",
    "method": "GET",
    "path": "/v1/compute/instances/{instance_id}/snapshots",
    "description": "Snapshots belonging to one instance",
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "list_object_storages",
    "method": "GET",
    "path": "/v1/object-storages",
    "description": "Contabo object storage (not the S3 API itself)"
  },
  {
    "name": "list_secrets",
    "method": "GET",
    "path": "/v1/secrets",
    "description": "Stored passwords and public SSH keys"
  },
  {
    "name": "list_tags",
    "method": "GET",
    "path": "/v1/tags",
    "description": "Tags used to group resources"
  },
  {
    "name": "start_instance",
    "method": "POST",
    "path": "/v1/compute/instances/{instance_id}/actions/start",
    "description": "Power an instance on",
    "requiresApproval": true,
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "stop_instance",
    "method": "POST",
    "path": "/v1/compute/instances/{instance_id}/actions/stop",
    "description": "Power an instance off \u2014 this will take down anything running on it",
    "requiresApproval": true,
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "restart_instance",
    "method": "POST",
    "path": "/v1/compute/instances/{instance_id}/actions/restart",
    "description": "Reboot an instance",
    "requiresApproval": true,
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "shutdown_instance",
    "method": "POST",
    "path": "/v1/compute/instances/{instance_id}/actions/shutdown",
    "description": "Graceful shutdown of an instance",
    "requiresApproval": true,
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      }
    }
  },
  {
    "name": "reset_instance_password",
    "method": "POST",
    "path": "/v1/compute/instances/{instance_id}/actions/resetPassword",
    "description": "Reset the root password \u2014 a supplied secretId, and it reboots",
    "requiresApproval": true,
    "params": {
      "instance_id": {
        "description": "the numeric instanceId"
      },
      "secret_id": {
        "type": "number",
        "in": "body",
        "required": true,
        "description": "secretId of the new password, from list_secrets"
      }
    }
  }
],
  "limits": "Contabo needs an OAuth token exchange, which this bridge does for you \u2014 the token is cached until it expires. Only instance listing is offered: the power and snapshot action paths are not shown in Contabo's public reference sample, so they are not guessed."
},
{
  "id": "vercel",
  "kind": "rest",
  "name": "Vercel",
  "category": "paas",
  "provider": "vercel",
  "description": "Projects, deployments and DNS for Vercel-hosted frontends",
  "docs": "https://vercel.com/docs/rest-api/reference",
  "baseUrl": "https://api.vercel.com",
  "auth": {
    "header": "authorization",
    "value": "Bearer ${VERCEL_TOKEN}"
  },
  "fields": [
    {
      "key": "VERCEL_TOKEN",
      "label": "Access token",
      "type": "password",
      "placeholder": "vercel.com/account/settings/tokens",
      "help": "Vercel \u2192 Account Settings \u2192 Tokens. Scope it to the team you want this component to touch."
    }
  ],
  "verbs": [
    {
      "name": "whoami",
      "method": "GET",
      "path": "/v2/user",
      "description": "The account this token belongs to \u2014 a good connection check"
    },
    {
      "name": "list_projects",
      "method": "GET",
      "path": "/v10/projects",
      "description": "Projects",
      "params": {
        "limit": {
          "type": "number",
          "in": "query"
        },
        "teamId": {
          "in": "query"
        },
        "slug": {
          "in": "query"
        }
      }
    },
    {
      "name": "get_project",
      "method": "GET",
      "path": "/v9/projects/{name}",
      "description": "One project by id or name",
      "params": {
        "name": {
          "description": "project id or name"
        },
        "teamId": {
          "in": "query"
        }
      }
    },
    {
      "name": "list_deployments",
      "method": "GET",
      "path": "/v7/deployments",
      "description": "Recent deployments, newest first",
      "params": {
        "projectId": {
          "in": "query"
        },
        "target": {
          "in": "query"
        },
        "state": {
          "in": "query"
        },
        "branch": {
          "in": "query"
        },
        "limit": {
          "type": "number",
          "in": "query"
        },
        "teamId": {
          "in": "query"
        },
        "slug": {
          "in": "query"
        }
      }
    },
    {
      "name": "get_deployment",
      "method": "GET",
      "path": "/v13/deployments/{id}",
      "description": "One deployment by id or URL",
      "params": {
        "id": {
          "description": "deployment uid or url"
        },
        "teamId": {
          "in": "query"
        }
      }
    },
    {
      "name": "cancel_deployment",
      "method": "PATCH",
      "path": "/v12/deployments/{id}/cancel",
      "description": "Cancel a running deployment",
      "params": {
        "id": {
          "description": "deployment uid"
        },
        "teamId": {
          "in": "query"
        }
      }
    },
    {
      "name": "delete_deployment",
      "method": "DELETE",
      "path": "/v13/deployments/{id}",
      "description": "Delete a deployment",
      "params": {
        "id": {
          "description": "deployment uid"
        },
        "teamId": {
          "in": "query"
        }
      }
    },
    {
      "name": "list_domains",
      "method": "GET",
      "path": "/v5/domains",
      "description": "Domains on this account",
      "params": {
        "limit": {
          "type": "number",
          "in": "query"
        },
        "teamId": {
          "in": "query"
        }
      }
    },
    {
      "name": "list_dns_records",
      "method": "GET",
      "path": "/v5/domains/{domain}/records",
      "description": "DNS records for a domain on Vercel's nameservers",
      "params": {
        "domain": {
          "description": "e.g. example.com"
        },
        "limit": {
          "type": "number",
          "in": "query"
        },
        "teamId": {
          "in": "query"
        }
      }
    }
  ],
  "limits": "Lists, cancels and deletes \u2014 but does not create deployments. Vercel's create endpoint takes a project, files or a git source in its body, which is not something to model blind from the reference."
},
{
  "id": "zeptomail",
  "kind": "rest",
  "name": "ZeptoMail",
  "category": "email",
  "provider": "zeptomail",
  "description": "Email, SMS and WhatsApp through Zoho CPaaS, the platform formerly called ZeptoMail",
  "docs": "https://www.zoho.com/cpaas/",
  "baseUrl": "https://api.zeptomail.com",
  "auth": {
    "header": "authorization",
    "value": "Zoho-enczapikey ${ZEPTOMAIL_TOKEN}"
  },
  "fields": [
    {
      "key": "ZEPTOMAIL_TOKEN",
      "label": "Send Mail Token",
      "type": "password",
      "placeholder": "from the Mail Agent's SMTP/API page",
      "help": "ZeptoMail \u2192 Mail Agents \u2192 your agent \u2192 SMTP/API \u2192 Send Mail Token. The \"from\" address must be a verified sender on that agent."
    }
  ],
  "verbs": [
  {
    "name": "send_email",
    "method": "POST",
    "path": "/v1.1/email",
    "description": "Send one transactional email",
    "requiresApproval": true,
    "params": {
      "from": {
        "in": "body",
        "required": true,
        "description": "a verified sender address"
      },
      "to": {
        "in": "body",
        "required": true,
        "description": "recipient address"
      },
      "subject": {
        "in": "body",
        "required": true
      },
      "htmlbody": {
        "in": "body",
        "required": true,
        "description": "the HTML body"
      }
    },
    "body_template": {
      "from": {
        "address": "{from}"
      },
      "to": [
        {
          "email_address": {
            "address": "{to}"
          }
        }
      ],
      "subject": "{subject}",
      "htmlbody": "{htmlbody}"
    }
  },
  {
    "name": "send_sms",
    "method": "POST",
    "path": "/v1.1/sms",
    "description": "Send an SMS built from an approved template",
    "requiresApproval": true,
    "params": {
      "sender_key": {
        "in": "body",
        "required": true,
        "description": "sender key of an approved SMS sender"
      },
      "template_key": {
        "in": "body",
        "required": true,
        "description": "key of an approved SMS template"
      },
      "mobile_no": {
        "in": "body",
        "required": true,
        "description": "recipient number including country code"
      }
    },
    "body_template": {
      "sender_key": "{sender_key}",
      "template_key": "{template_key}",
      "to": [
        {
          "mobile_no": "{mobile_no}"
        }
      ]
    }
  },
  {
    "name": "send_whatsapp",
    "method": "POST",
    "path": "/v1.1/whatsapp",
    "description": "Send a WhatsApp message built from an approved template",
    "requiresApproval": true,
    "params": {
      "from": {
        "in": "body",
        "required": true,
        "description": "your WhatsApp business number"
      },
      "to": {
        "in": "body",
        "required": true,
        "description": "recipient number including country code"
      },
      "template_key": {
        "in": "body",
        "required": true,
        "description": "key of an approved WhatsApp template"
      }
    },
    "body_template": {
      "from": "{from}",
      "to": "{to}",
      "template_key": "{template_key}"
    }
  }
],
  "limits": "Sending only. Every path here was confirmed against the live API, and the Send Mail Token only authorises POST /v1.1/email, /v1.1/sms and /v1.1/whatsapp. The read endpoints exist but reject that token - GET /v1.1/domains, /v1.1/agents, /v1.1/email/logs, /v1.1/sms/logs, /v1.1/whatsapp/logs and /v1.1/voice/logs all answer 401 Invalid Authorization token with it - so they are not offered rather than shipped broken. Bounces, delivery logs and verified domains are therefore dashboard-only on ZeptoMail; use Postmark for bounces and stats. Sending beyond email is template-based: SMS needs an approved template_key and sender_key, WhatsApp an approved template_key and your business number, so those trigger pre-approved templates rather than free text. Voice exists at /v1.1/voice and is not offered because it authenticates with a Zoho OAuth2 token rather than the agent token every other channel uses. SMS is available only in Zoho's India data centre. There is no HTTP endpoint for credit balance."
}
];
