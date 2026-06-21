# Resume Email Agent

A hiring tool with two features: send JD + assessment emails to candidates, and schedule interviews with a Google Meet link via calendar invite.

## Features

### Email Agent
Upload a candidate's resume, attach a job description and assessment file, and send them a formatted email. The app auto-extracts the candidate's email from the resume.

### Schedule Interview
Schedule an interview by sending a calendar invite (`.ics`) with a Google Meet link. The candidate and any additional attendees (interviewers, hiring managers) all receive the invite and can add it to their calendar.

- Pick a date, time, and duration
- Your Google Meet link is saved in the browser and reused for every interview automatically
- Add as many additional attendees as needed — each gets the calendar invite

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
npx pnpm@latest dev
```

Or with a global pnpm:

```bash
pnpm install
pnpm dev
```

The app will be served locally (defaults from Vite setup).

## Build / Production

```bash
pnpm build
pnpm start
```

`pnpm build` creates production builds for client and server; `pnpm start` runs the server build.

## How to use

### Sending a JD + Assessment Email

1. Start the server and open the app.
2. Click **Email Agent** in the nav bar.
3. Upload the candidate's resume — the app extracts their email automatically.
4. Attach the job description (PDF) and assessment file.
5. Fill in the email subject and body, then click **Send Mail**.

### Scheduling an Interview

1. Click **Schedule Interview** in the nav bar.
2. Upload the candidate's resume to extract their email.
3. Pick the interview **date**, **time**, and **duration**.
4. Enter your **Google Meet link** (saved automatically for future use).
5. Add any **additional attendees** (interviewers, hiring managers) who should receive the invite.
6. Review the pre-filled email body and click **Send Interview Invite**.

The candidate and all attendees receive an email with a `.ics` calendar attachment. Opening it adds the interview to their calendar with the Meet link embedded.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/process-resume` | Extract email from uploaded resume |
| POST | `/api/send-email` | Send JD + assessment email with attachments |
| POST | `/api/schedule-interview` | Send calendar invite with Google Meet link |
| GET | `/api/smtp-config` | Return server-configured SMTP settings |

## Troubleshooting

- If Gmail rejects the login, ensure you used an App Password (not your account password) and that 2-Step Verification is enabled on the account.
- The `SMTP_USER` must match the account the App Password was generated for.
- Check server logs for `Error sending email:` or `Error scheduling interview:` messages.

## Development Notes

- SMTP credentials are read from environment variables server-side. The frontend pre-fills `SMTP_USER` if the server exposes it via `/api/smtp-config`.
- The Google Meet link is stored in the browser's `localStorage` under the key `interview_meet_link` — no server storage needed.
- All sensitive operations happen server-side; secrets never reach client code.
