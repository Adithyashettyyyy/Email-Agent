import { RequestHandler } from "express";
import nodemailer from "nodemailer";

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

function formatICSLocal(date: Date): string {
  return `${date.getFullYear()}${padTwo(date.getMonth() + 1)}${padTwo(date.getDate())}T${padTwo(date.getHours())}${padTwo(date.getMinutes())}00`;
}

function formatICSUTC(date: Date): string {
  return `${date.getUTCFullYear()}${padTwo(date.getUTCMonth() + 1)}${padTwo(date.getUTCDate())}T${padTwo(date.getUTCHours())}${padTwo(date.getUTCMinutes())}00Z`;
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@resume-agent`;
}

function generateICS({
  uid,
  summary,
  description,
  location,
  organizer,
  attendees,
  dtstart,
  dtend,
}: {
  uid: string;
  summary: string;
  description: string;
  location: string;
  organizer: string;
  attendees: string[];
  dtstart: Date;
  dtend: Date;
}): string {
  const dtstamp = formatICSUTC(new Date());
  const start = formatICSLocal(dtstart);
  const end = formatICSLocal(dtend);

  const attendeeLines = attendees
    .map(
      (a) =>
        `ATTENDEE;CN="${a}";PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a}`,
    )
    .join("\r\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Resume Agent//Interview Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    `URL:${location}`,
    `ORGANIZER;CN="${organizer}":mailto:${organizer}`,
    attendeeLines,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview starting in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function getSmtpConfig(body: Record<string, string>) {
  const user = (body.smtpUser || process.env.SMTP_USER || "").trim();
  const password = (body.smtpPassword || process.env.SMTP_PASSWORD || "")
    .trim()
    .replace(/\s/g, "");
  return {
    host: (body.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com").trim(),
    port: Number(body.smtpPort || process.env.SMTP_PORT || "587"),
    user,
    password,
  } as const;
}

function formatSmtpError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Failed to send email";
  if (message.includes("535") || message.includes("BadCredentials")) {
    return "Gmail rejected the login. Generate a new App Password (with 2-Step Verification on), update SMTP_PASSWORD in .env, and restart the server.";
  }
  return message;
}

export const handleScheduleInterview: RequestHandler = async (req, res) => {
  try {
    const {
      candidateEmail,
      date,
      time,
      duration,
      meetLink,
      additionalAttendees,
      subject,
      emailBody,
    } = req.body as {
      candidateEmail: string;
      date: string;
      time: string;
      duration: string;
      meetLink: string;
      additionalAttendees: string[];
      subject: string;
      emailBody: string;
    };

    if (!candidateEmail?.trim()) {
      res.status(400).json({ error: "Candidate email is required" });
      return;
    }
    if (!date) {
      res.status(400).json({ error: "Interview date is required" });
      return;
    }
    if (!meetLink?.trim()) {
      res.status(400).json({ error: "Google Meet link is required" });
      return;
    }
    if (!subject?.trim()) {
      res.status(400).json({ error: "Email subject is required" });
      return;
    }

    const smtp = getSmtpConfig(req.body as Record<string, string>);
    if (!smtp.user || !smtp.password) {
      res.status(400).json({
        error:
          "SMTP credentials missing. Add SMTP_USER and SMTP_PASSWORD to your .env file.",
      });
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = (time || "10:00").split(":").map(Number);
    const dtstart = new Date(year, month - 1, day, hour, minute, 0);
    const dtend = new Date(
      dtstart.getTime() + Number(duration || "60") * 60 * 1000,
    );

    const extraAttendees = Array.isArray(additionalAttendees)
      ? additionalAttendees.filter((a) => a.trim())
      : [];
    const allAttendees = [candidateEmail.trim(), ...extraAttendees];

    const uid = generateUID();
    const icsContent = generateICS({
      uid,
      summary: subject.trim(),
      description: (emailBody || "").trim(),
      location: meetLink.trim(),
      organizer: smtp.user,
      attendees: allAttendees,
      dtstart,
      dtend,
    });

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      auth: { user: smtp.user, pass: smtp.password },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: smtp.user,
      to: allAttendees.join(", "),
      subject: subject.trim(),
      text: (emailBody || "").trim(),
      attachments: [
        {
          filename: "interview-invite.ics",
          content: icsContent,
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });

    res.json({
      success: true,
      message: `Interview invite sent to ${allAttendees.join(", ")}`,
      attendees: allAttendees,
    });
  } catch (error) {
    console.error("Error scheduling interview:", error);
    res.status(500).json({ error: formatSmtpError(error) });
  }
};
