import { RequestHandler } from "express";
import { SmtpConfigResponse } from "@shared/api";

export const handleSmtpConfig: RequestHandler = (_req, res) => {
  const user = process.env.SMTP_USER || "";
  const password = process.env.SMTP_PASSWORD || "";

  const oauthConfigured = Boolean(
    process.env.SMTP_USE_OAUTH === "true" ||
      (process.env.SMTP_OAUTH_CLIENT_ID && process.env.SMTP_OAUTH_CLIENT_SECRET && process.env.SMTP_OAUTH_REFRESH_TOKEN)
  );

  const response: SmtpConfigResponse = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || "587",
    user,
    passwordConfigured: Boolean(user && password),
    oauthConfigured,
  };

  res.json(response);
};
