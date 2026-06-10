import { useState, useRef, useEffect } from "react";
import { File as FileIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import type { SendEmailResponse, SmtpConfigResponse } from "@shared/api";

interface FormData {
  resume: File | null;
  jdFile: File | null;
  assessmentFile: File | null;
  subject: string;
  emailBody: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  toEmail: string;
}

const DEFAULT_TO_EMAIL = "your@email.com";

export default function Index() {
  const [formData, setFormData] = useState<FormData>({
    resume: null,
    jdFile: null,
    assessmentFile: null,
    subject: "Exciting Opportunity — JD & Assessment Enclosed",
    emailBody: `Hi,

Thank you for your interest in the role. Please find attached:
1. Job Description — overview of responsibilities and requirements
2. Assessment — please complete and return within 3 business days

Looking forward to hearing from you.

Best regards,
The Hiring Team`,
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    toEmail: DEFAULT_TO_EMAIL,
  });

  const [smtpConfiguredFromEnv, setSmtpConfiguredFromEnv] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [useOauth, setUseOauth] = useState(false);
  const [isExtractingEmail, setIsExtractingEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch("/api/smtp-config")
      .then((res) => res.json())
      .then((data: SmtpConfigResponse) => {
        setFormData((prev) => ({
          ...prev,
          smtpHost: data.host,
          smtpPort: data.port,
          smtpUser: data.user,
        }));
        setSmtpConfiguredFromEnv(data.passwordConfigured);
        setOauthConfigured(Boolean((data as any).oauthConfigured));
        // prefer OAuth if available
        if ((data as any).oauthConfigured) setUseOauth(true);
      })
      .catch(() => {
        toast.error("Could not load email settings from server");
      });
  }, []);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const assessmentInputRef = useRef<HTMLInputElement>(null);

  const extractEmailFromResume = async (file: File) => {
    setIsExtractingEmail(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("resume", file);

      const response = await fetch("/api/process-resume", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not extract email from resume");
      }

      setFormData((prev) => ({
        ...prev,
        toEmail: data.email,
      }));
      toast.success(`Found candidate email: ${data.email}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract email";
      toast.error(message);
    } finally {
      setIsExtractingEmail(false);
    }
  };

  const handleResumeSelected = async (file: File) => {
    setFormData((prev) => ({
      ...prev,
      resume: file,
    }));
    await extractEmailFromResume(file);
  };

  const handleFileInput = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "resume" | "jdFile" | "assessmentFile",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "resume") {
      await handleResumeSelected(file);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [type]: file,
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (
    e: React.DragEvent,
    type: "resume" | "jdFile" | "assessmentFile",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (type === "resume") {
      await handleResumeSelected(file);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [type]: file,
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.resume) {
      toast.error("Upload a resume first");
      return;
    }

    if (formData.toEmail === DEFAULT_TO_EMAIL || !formData.toEmail.trim()) {
      toast.error("Candidate email not found. Upload a resume with a valid email.");
      return;
    }

    if (!formData.jdFile) {
      toast.error("Attach the job description file");
      return;
    }

    if (!formData.assessmentFile) {
      toast.error("Attach the assessment file");
      return;
    }

    if (!smtpConfiguredFromEnv && !(useOauth && oauthConfigured) && !formData.smtpPassword.trim()) {
      toast.error("Add SMTP_PASSWORD to your .env file, or enter an app password, or enable OAuth2 if configured on the server.");
      return;
    }

    setIsSending(true);
    try {
      const payload = new FormData();
      payload.append("subject", formData.subject);
      payload.append("emailBody", formData.emailBody);
      payload.append("toEmail", formData.toEmail);
      payload.append("smtpHost", formData.smtpHost);
      payload.append("smtpPort", formData.smtpPort);
      payload.append("smtpUser", formData.smtpUser);
      if (formData.smtpPassword.trim()) {
        payload.append("smtpPassword", formData.smtpPassword);
      }
      if (useOauth) payload.append("useOauth", "true");
      payload.append("jdFile", formData.jdFile);
      payload.append("assessmentFile", formData.assessmentFile);

      const response = await fetch("/api/send-email", {
        method: "POST",
        body: payload,
      });

      const data = (await response.json()) as SendEmailResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      toast.success(data.message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const hasCandidateEmail =
    formData.toEmail !== DEFAULT_TO_EMAIL && formData.toEmail.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-900 relative overflow-hidden">
      {/* Header Navigation */}
      <div className="bg-gray-950/80 backdrop-blur-sm border-b border-purple-500/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Resume Agent</span>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-4">
              <button className="text-cyan-400 text-sm px-4 py-2 transition-colors hover:text-pink-400 border border-cyan-400/30 hover:border-pink-400/30 rounded">
                Email Agent
              </button>
              <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 md:h-64 bg-gradient-to-t from-cyan-400/20 to-transparent transform -skew-y-2"></div>
      <div className="relative py-12 md:py-16 px-4 md:px-6 z-10">
      <div className="max-w-2xl mx-auto">
        {/* Hero Title */}
        <div className="text-center mb-6 md:mb-8 pt-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Resume <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Email</span> Agent
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* 1. Upload Resume */}
          <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full border border-cyan-400 flex items-center justify-center text-xs bg-cyan-400/10 text-cyan-400 flex-shrink-0">
                1
              </span>
              <h2 className="text-base md:text-lg font-semibold text-cyan-400 uppercase tracking-wide">
                Upload Resume
              </h2>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "resume")}
              onClick={() => resumeInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-500/30 rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-cyan-500/60 transition-colors bg-cyan-500/5"
            >
              <FileIcon className="w-6 md:w-8 h-6 md:h-8 text-cyan-400/70 mx-auto mb-2 md:mb-3" />
              <p className="text-cyan-300 mb-1 text-sm md:text-base">
                Drop PDF or DOCX here
              </p>
              <p className="text-xs text-cyan-400/60">click to browse - pdf, docx supported</p>
              {formData.resume && (
                <p className="mt-2 md:mt-3 text-cyan-400 text-xs md:text-sm font-semibold truncate">{formData.resume.name}</p>
              )}
              <input
                ref={resumeInputRef}
                type="file"
                onChange={(e) => handleFileInput(e, "resume")}
                className="hidden"
                accept=".pdf,.docx,.doc"
              />
            </div>
          </div>

          {/* Email Status Box */}
          <div className="border border-green-500/30 rounded-lg p-4 md:p-6 bg-green-500/10 backdrop-blur-sm">
            {isExtractingEmail ? (
              <p className="text-green-400/70 text-sm">⏳ Extracting email from resume...</p>
            ) : formData.resume && hasCandidateEmail ? (
              <>
                <p className="text-green-400 text-sm">✓ Email extracted successfully from resume</p>
                <p className="text-green-300 text-xs mt-2 font-mono break-all">📧 {formData.toEmail}</p>
              </>
            ) : (
              <p className="text-green-400/70 text-sm">⏳ Upload resume to extract email</p>
            )}
          </div>

          {/* SMTP / OAuth Status */}
          <div className="border border-yellow-500/30 rounded-lg p-4 md:p-6 bg-yellow-500/10 backdrop-blur-sm flex items-center justify-between">
            <div>
              <p className="text-yellow-300 text-sm">Mail delivery options</p>
              <p className="text-yellow-200 text-xs mt-1">
                SMTP (App Password): {smtpConfiguredFromEnv ? "configured" : "not configured"} • OAuth2: {oauthConfigured ? "configured" : "not configured"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-yellow-200">Use OAuth2</label>
              <input type="checkbox" checked={useOauth} onChange={(e) => setUseOauth(e.target.checked)} className="w-4 h-4" />
            </div>
          </div>

          {/* 2. Attachments */}
          <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full border border-purple-400 flex items-center justify-center text-xs bg-purple-400/10 text-purple-400 flex-shrink-0">
                2
              </span>
              <h2 className="text-base md:text-lg font-semibold text-purple-400 uppercase tracking-wide">
                Attachments
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* JD File */}
              <div className="space-y-2">
                <label className="text-xs text-purple-300/70 uppercase tracking-wide">
                  JD Description
                </label>
                <div
                  onClick={() => jdInputRef.current?.click()}
                  className="border border-purple-500/30 rounded p-3 md:p-4 text-center cursor-pointer hover:border-purple-500/60 transition-colors bg-purple-500/5 min-h-16 flex flex-col items-center justify-center"
                >
                  <p className="text-xs md:text-sm text-purple-300/70">
                    + attach jd <span className="text-purple-400/40">no file</span>
                  </p>
                  {formData.jdFile && (
                    <p className="mt-1 md:mt-2 text-purple-400 text-xs font-semibold truncate w-full px-1">{formData.jdFile.name}</p>
                  )}
                  <input
                    ref={jdInputRef}
                    type="file"
                    onChange={(e) => handleFileInput(e, "jdFile")}
                    className="hidden"
                    accept=".pdf"
                  />
                </div>
              </div>

              {/* Assessment File */}
              <div className="space-y-2">
                <label className="text-xs text-purple-300/70 uppercase tracking-wide">
                  Assessment File
                </label>
                <div
                  onClick={() => assessmentInputRef.current?.click()}
                  className="border border-purple-500/30 rounded p-3 md:p-4 text-center cursor-pointer hover:border-purple-500/60 transition-colors bg-purple-500/5 min-h-16 flex flex-col items-center justify-center"
                >
                  <p className="text-xs md:text-sm text-purple-300/70">
                    + attach assessment <span className="text-purple-400/40">no file</span>
                  </p>
                  {formData.assessmentFile && (
                    <p className="mt-1 md:mt-2 text-purple-400 text-xs font-semibold truncate w-full px-1">{formData.assessmentFile.name}</p>
                  )}
                  <input
                    ref={assessmentInputRef}
                    type="file"
                    onChange={(e) => handleFileInput(e, "assessmentFile")}
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Email Content */}
          <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full border border-pink-400 flex items-center justify-center text-xs bg-pink-400/10 text-pink-400 flex-shrink-0">
                3
              </span>
              <h2 className="text-base md:text-lg font-semibold text-pink-400 uppercase tracking-wide">
                Email Content
              </h2>
            </div>

            <div className="space-y-3 md:space-y-4">
              {/* Subject Line */}
              <div>
                <label className="text-xs text-pink-300/70 uppercase tracking-wide block mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full bg-gray-900/50 border border-pink-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-pink-400/40 focus:outline-none focus:border-pink-500/60"
                />
              </div>

              {/* Email Body */}
              <div>
                <label className="text-xs text-pink-300/70 uppercase tracking-wide block mb-2">
                  Email Body
                </label>
                <textarea
                  name="emailBody"
                  value={formData.emailBody}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full bg-gray-900/50 border border-pink-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-pink-400/40 focus:outline-none focus:border-pink-500/60 resize-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Sender & Recipient */}
          <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full border border-cyan-400 flex items-center justify-center text-xs bg-cyan-400/10 text-cyan-400 flex-shrink-0">
                4
              </span>
              <h2 className="text-base md:text-lg font-semibold text-cyan-400 uppercase tracking-wide">
                Sender & Recipient
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
              <div>
                <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                  SMTP Host
                </label>
                <input
                  type="text"
                  name="smtpHost"
                  value={formData.smtpHost}
                  onChange={handleInputChange}
                  disabled={smtpConfiguredFromEnv}
                  className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                  SMTP Port
                </label>
                <input
                  type="text"
                  name="smtpPort"
                  value={formData.smtpPort}
                  onChange={handleInputChange}
                  disabled={smtpConfiguredFromEnv}
                  className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                  Your Email Address
                </label>
                <input
                  type="email"
                  name="smtpUser"
                  value={formData.smtpUser}
                  onChange={handleInputChange}
                  disabled={smtpConfiguredFromEnv}
                  className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                  App Password
                </label>
                <div className="relative">
                  <input
                    id="smtpPasswordInput"
                    type="password"
                    name="smtpPassword"
                    value={formData.smtpPassword}
                    onChange={handleInputChange}
                    placeholder={smtpConfiguredFromEnv ? "Using saved app password" : "Or set SMTP_PASSWORD in .env"}
                    disabled={smtpConfiguredFromEnv}
                    className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(
                        "smtpPasswordInput",
                      ) as HTMLInputElement;
                      if (input) {
                        input.type = input.type === "password" ? "text" : "password";
                      }
                    }}
                    disabled={smtpConfiguredFromEnv}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/60 hover:text-cyan-400 disabled:opacity-60"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400/70 hover:text-cyan-400 mt-1 inline-block"
                  >
                    Generate App Password →
                  </a>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                Candidate Email Address
              </label>
              <input
                type="email"
                name="toEmail"
                value={formData.toEmail}
                onChange={handleInputChange}
                className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>

          {/* 5. Send Button */}
          <div className="flex items-center gap-2 px-4 md:px-6 py-3 md:py-4">
            <span className="w-6 h-6 rounded-full border border-green-400 flex items-center justify-center text-xs bg-green-400/10 text-green-400 flex-shrink-0">
              5
            </span>
            <h2 className="text-base md:text-lg font-semibold text-green-400 uppercase tracking-wide">
              Send
            </h2>
          </div>

          <button
            type="submit"
            disabled={isSending || isExtractingEmail}
            className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm md:text-base"
          >
            {isSending ? "Sending..." : "• Send Mail"}
          </button>
        </form>

      </div>
      </div>
    </div>
  );
}
