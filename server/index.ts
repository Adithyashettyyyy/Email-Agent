import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleProcessResume } from "./routes/process-resume";
import { handleSendEmail } from "./routes/send-email";
import { handleSmtpConfig } from "./routes/smtp-config";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/smtp-config", handleSmtpConfig);

  app.post("/api/process-resume", upload.single("resume"), handleProcessResume);

  app.post(
    "/api/send-email",
    upload.fields([
      { name: "jdFile", maxCount: 1 },
      { name: "assessmentFile", maxCount: 1 },
    ]),
    handleSendEmail,
  );

  return app;
}
