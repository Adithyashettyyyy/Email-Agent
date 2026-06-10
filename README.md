# Resume Email Agent

This project sends resume and assessment emails to candidates.

## Environment

Copy `server/.env.example` to `server/.env` and fill your credentials.

Two options to send email:

1. SMTP with App Password (simpler)
   - Set `SMTP_USER` and `SMTP_PASSWORD` (App Password) in `server/.env`.
2. Gmail OAuth2 (recommended for long-term deployments)
   - Set `SMTP_USE_OAUTH=true` and provide `SMTP_OAUTH_CLIENT_ID`, `SMTP_OAUTH_CLIENT_SECRET`, `SMTP_OAUTH_REFRESH_TOKEN`, and `SMTP_USER`.

The server endpoint `/api/smtp-config` reports `passwordConfigured` and `oauthConfigured` so the frontend can show available options.

## Running

Install dependencies and run dev:

```bash
pnpm install
pnpm dev
```
