import { RequestHandler } from "express";
import { ProcessResumeResponse } from "@shared/api";
import { extractEmail, extractTextFromResume } from "../lib/resume-text";

export const handleProcessResume: RequestHandler = async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const extractedText = await extractTextFromResume(
      req.file.buffer,
      req.file.originalname,
    );

    const email = extractEmail(extractedText);

    if (!email) {
      res.status(400).json({ error: "Could not extract email from resume" });
      return;
    }

    const response: ProcessResumeResponse = {
      email,
      fileName: req.file.originalname,
    };

    res.json(response);
  } catch (error) {
    console.error("Error processing resume:", error);
    res.status(500).json({ error: "Failed to process resume" });
  }
};
