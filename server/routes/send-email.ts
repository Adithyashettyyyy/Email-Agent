import { RequestHandler } from "express";
import nodemailer from "nodemailer";
import { SendEmailResponse } from "@shared/api";

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
    // (only username/password SMTP supported)
  } as const;
}

function formatSmtpError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to send email";

  if (message.includes("535") || message.includes("BadCredentials")) {
    return "Gmail rejected the login. Generate a new App Password (with 2-Step Verification on), update SMTP_PASSWORD in .env, and restart the server.";
  }

  return message;
}

export const handleSendEmail: RequestHandler = async (req, res) => {
  try {
    const { subject, emailBody, toEmail } = req.body as Record<string, string>;

    if (!toEmail?.trim()) {
      res.status(400).json({ error: "Candidate email is required" });
      return;
    }

    if (!subject?.trim()) {
      res.status(400).json({ error: "Email subject is required" });
      return;
    }

    if (!emailBody?.trim()) {
      res.status(400).json({ error: "Email body is required" });
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

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    const jdFile = files?.jdFile?.[0];
    const assessmentFile = files?.assessmentFile?.[0];

    if (!jdFile) {
      res.status(400).json({ error: "Job description file is required" });
      return;
    }

    if (!assessmentFile) {
      res.status(400).json({ error: "Assessment file is required" });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: smtp.user,
      to: toEmail.trim(),
      subject: subject.trim(),
      text: emailBody.trim(),
      attachments: [
        {
          filename: jdFile.originalname,
          content: jdFile.buffer,
        },
        {
          filename: assessmentFile.originalname,
          content: assessmentFile.buffer,
        },
      ],
    });

    const response: SendEmailResponse = {
      success: true,
      message: `Email sent to ${toEmail.trim()}`,
      from: smtp.user,
      to: toEmail.trim(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: formatSmtpError(error) });
  }
};
