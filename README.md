# Resume Email Agent

This project helps send resumes and assessments to candidate email addresses.

## Overview

The server sends emails using SMTP credentials (username + password). For Gmail, use an App Password with 2-Step Verification enabled.

This repository contains a small frontend (React + Vite) and an Express server that handles file uploads and sends emails with attachments.

## Environment

Create a `.env` file in the `server/` folder. You can copy the example:

```bash
cp server/.env.example server/.env
```

Fill in your SMTP settings in `server/.env`:

```
SMTP_USER=you@example.com
SMTP_PASSWORD=your_app_password_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

Important:
- Do NOT commit `server/.env` to version control.
- For Gmail: enable 2-Step Verification and generate an App Password. Use that value for `SMTP_PASSWORD`.

## Install

This project prefers `pnpm`. If you don't have `pnpm` installed globally, you can use `npx pnpm@latest`.

```bash
# from repo root
npx pnpm@latest install
```

## Run (development)

```bash
# start the dev server (client + server integration)
npx pnpm@latest dev
```

Or with a global pnpm:

```bash
pnpm install
pnpm dev
```

The app will be served locally (defaults from Vite setup). The UI uploads resumes and attachments to the server and sends emails using the configured SMTP credentials.

## Build / Production

```bash
pnpm build
pnpm start
```

`pnpm build` creates production builds for client and server; `pnpm start` runs the server build.

## How to use

1. Start the server.
2. Open the frontend in your browser.
3. Upload a candidate's resume — the app will attempt to extract the candidate's email from the resume automatically.
4. Attach the job description and assessment files.
5. Click send. If the server has `SMTP_USER` and `SMTP_PASSWORD` configured, the email will be sent.

## Troubleshooting

- If you see a login rejected error from Gmail, ensure:
  - You used an App Password (not your normal account password)
  - 2-Step Verification is enabled on the Gmail account
  - `SMTP_USER` matches the account the App Password was generated for

- Check server logs for `Error sending email:` messages when troubleshooting.

## Development Notes

- SMTP credentials are read from environment variables on the server. The frontend will pre-fill `SMTP_USER` if the server exposes it via `/api/smtp-config`.
- Keep secrets out of client code; all sensitive operations happen server-side.

If you want me to also remove the `pnpm-lock.yaml` changes related to oauth or clean up node_modules, tell me and I'll revert or prune them.
