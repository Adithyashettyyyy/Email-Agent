import { useState, useRef, useEffect } from "react";
import { File as FileIcon, Plus, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import type { SmtpConfigResponse } from "@shared/api";

const MEET_LINK_KEY = "interview_meet_link";
const DEFAULT_TO_EMAIL = "your@email.com";

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = i % 2 === 0 ? "00" : "30";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? "PM" : "AM";
  return {
    value: `${String(hour).padStart(2, "0")}:${minute}`,
    label: `${h12}:${minute} ${ampm}`,
  };
});

const DURATIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
];

export default function ScheduleInterview() {
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [resume, setResume] = useState<File | null>(null);
  const [candidateEmail, setCandidateEmail] = useState(DEFAULT_TO_EMAIL);
  const [isExtractingEmail, setIsExtractingEmail] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [meetLink, setMeetLink] = useState(
    () =>
      localStorage.getItem(MEET_LINK_KEY) ||
      "https://meet.google.com/cje-bgte-mix",
  );
  const [additionalAttendees, setAdditionalAttendees] = useState<string[]>([
    "",
  ]);
  const [subject, setSubject] = useState("Interview Invitation");
  const [emailBody, setEmailBody] = useState("");
  const [smtpConfiguredFromEnv, setSmtpConfiguredFromEnv] = useState(false);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch("/api/smtp-config")
      .then((res) => res.json())
      .then((data: SmtpConfigResponse) => {
        setSmtpHost(data.host);
        setSmtpPort(data.port);
        setSmtpUser(data.user);
        setSmtpConfiguredFromEnv(data.passwordConfigured);
      })
      .catch(() => toast.error("Could not load email settings from server"));
  }, []);

  useEffect(() => {
    const dateStr = date ? format(date, "MMMM d, yyyy") : "[Date TBD]";
    const timeSlot = TIME_SLOTS.find((t) => t.value === time);
    const timeStr = timeSlot ? timeSlot.label : time;
    const durationLabel =
      DURATIONS.find((d) => d.value === duration)?.label || `${duration} minutes`;
    const meetStr = meetLink || "[Google Meet Link]";

    setEmailBody(`Hi,

We are pleased to invite you for an interview.

Interview Details:
  Date: ${dateStr}
  Time: ${timeStr}
  Duration: ${durationLabel}
  Google Meet: ${meetStr}

Please join the meeting using the link above at the scheduled time. A calendar invite is attached to this email.

Best regards,
The Hiring Team`);
  }, [date, time, duration, meetLink]);

  useEffect(() => {
    if (meetLink) localStorage.setItem(MEET_LINK_KEY, meetLink);
  }, [meetLink]);

  const extractEmailFromResume = async (file: File) => {
    setIsExtractingEmail(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/process-resume", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not extract email");
      setCandidateEmail(data.email);
      toast.success(`Found candidate email: ${data.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extract email");
    } finally {
      setIsExtractingEmail(false);
    }
  };

  const handleResumeDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setResume(file);
    await extractEmailFromResume(file);
  };

  const handleResumeInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResume(file);
    await extractEmailFromResume(file);
  };

  const addAttendee = () =>
    setAdditionalAttendees([...additionalAttendees, ""]);

  const removeAttendee = (index: number) =>
    setAdditionalAttendees(additionalAttendees.filter((_, i) => i !== index));

  const updateAttendee = (index: number, value: string) =>
    setAdditionalAttendees(
      additionalAttendees.map((a, i) => (i === index ? value : a)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resume) {
      toast.error("Upload a resume first");
      return;
    }
    if (candidateEmail === DEFAULT_TO_EMAIL || !candidateEmail.trim()) {
      toast.error(
        "Candidate email not found. Upload a resume with a valid email.",
      );
      return;
    }
    if (!date) {
      toast.error("Select an interview date");
      return;
    }
    if (!meetLink.trim()) {
      toast.error("Enter your Google Meet link");
      return;
    }
    if (!smtpConfiguredFromEnv && !smtpPassword.trim()) {
      toast.error(
        "Add SMTP_PASSWORD to your .env file, or enter an app password",
      );
      return;
    }

    setIsSending(true);
    try {
      const validAttendees = additionalAttendees.filter((a) => a.trim());

      const payload = {
        candidateEmail,
        date: format(date, "yyyy-MM-dd"),
        time,
        duration,
        meetLink,
        additionalAttendees: validAttendees,
        subject,
        emailBody,
        smtpHost,
        smtpPort,
        smtpUser,
        ...(smtpPassword.trim() ? { smtpPassword } : {}),
      };

      const res = await fetch("/api/schedule-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation");

      toast.success(data.message);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to send invitation",
      );
    } finally {
      setIsSending(false);
    }
  };

  const hasCandidateEmail =
    candidateEmail !== DEFAULT_TO_EMAIL && candidateEmail.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-900 relative overflow-hidden">
      {/* Header */}
      <div className="bg-gray-950/80 backdrop-blur-sm border-b border-purple-500/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Resume Agent
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-cyan-400 text-sm px-4 py-2 transition-colors hover:text-pink-400 border border-cyan-400/30 hover:border-pink-400/30 rounded"
              >
                Email Agent
              </button>
              <button
                type="button"
                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 md:h-64 bg-gradient-to-t from-cyan-400/20 to-transparent transform -skew-y-2"></div>

      <div className="relative py-12 md:py-16 px-4 md:px-6 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 md:mb-8 pt-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Schedule{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                Interview
              </span>
            </h1>
          </div>

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
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={handleResumeDrop}
                onClick={() => resumeInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-cyan-500/60 transition-colors bg-cyan-500/5"
              >
                <FileIcon className="w-6 md:w-8 h-6 md:h-8 text-cyan-400/70 mx-auto mb-2 md:mb-3" />
                <p className="text-cyan-300 mb-1 text-sm md:text-base">
                  Drop PDF or DOCX here
                </p>
                <p className="text-xs text-cyan-400/60">
                  click to browse - pdf, docx supported
                </p>
                {resume && (
                  <p className="mt-2 md:mt-3 text-cyan-400 text-xs md:text-sm font-semibold truncate">
                    {resume.name}
                  </p>
                )}
                <input
                  ref={resumeInputRef}
                  type="file"
                  onChange={handleResumeInput}
                  className="hidden"
                  accept=".pdf,.docx,.doc"
                />
              </div>
            </div>

            {/* Email Status */}
            <div className="border border-green-500/30 rounded-lg p-4 md:p-6 bg-green-500/10 backdrop-blur-sm">
              {isExtractingEmail ? (
                <p className="text-green-400/70 text-sm">
                  ⏳ Extracting email from resume...
                </p>
              ) : resume && hasCandidateEmail ? (
                <>
                  <p className="text-green-400 text-sm">
                    ✓ Email extracted successfully from resume
                  </p>
                  <p className="text-green-300 text-xs mt-2 font-mono break-all">
                    📧 {candidateEmail}
                  </p>
                </>
              ) : (
                <p className="text-green-400/70 text-sm">
                  ⏳ Upload resume to extract candidate email
                </p>
              )}
            </div>

            {/* 2. Interview Schedule */}
            <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full border border-purple-400 flex items-center justify-center text-xs bg-purple-400/10 text-purple-400 flex-shrink-0">
                  2
                </span>
                <h2 className="text-base md:text-lg font-semibold text-purple-400 uppercase tracking-wide">
                  Interview Schedule
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-xs text-purple-300/70 uppercase tracking-wide block">
                    Date
                  </label>
                  <input
                    type="date"
                    min={format(new Date(), "yyyy-MM-dd")}
                    value={date ? format(date, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split("-").map(Number);
                        setDate(new Date(y, m - 1, d));
                      } else {
                        setDate(undefined);
                      }
                    }}
                    className="w-full bg-gray-900/50 border border-purple-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 [color-scheme:dark] cursor-pointer"
                  />
                </div>

                {/* Time Picker */}
                <div className="space-y-2">
                  <label className="text-xs text-purple-300/70 uppercase tracking-wide block">
                    Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 pointer-events-none" />
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-gray-900/50 border border-purple-500/30 rounded px-3 py-2 pl-9 text-sm text-white focus:outline-none focus:border-purple-500/60 appearance-none cursor-pointer"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option
                          key={slot.value}
                          value={slot.value}
                          className="bg-gray-900"
                        >
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-xs text-purple-300/70 uppercase tracking-wide block">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-gray-900/50 border border-purple-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 appearance-none cursor-pointer"
                  >
                    {DURATIONS.map((d) => (
                      <option
                        key={d.value}
                        value={d.value}
                        className="bg-gray-900"
                      >
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Google Meet Link */}
            <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full border border-pink-400 flex items-center justify-center text-xs bg-pink-400/10 text-pink-400 flex-shrink-0">
                  3
                </span>
                <h2 className="text-base md:text-lg font-semibold text-pink-400 uppercase tracking-wide">
                  Google Meet Link
                </h2>
              </div>
              <div>
                <label className="text-xs text-pink-300/70 uppercase tracking-wide block mb-2">
                  Meet URL
                </label>
                <input
                  type="url"
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/xxx-yyyy-zzz"
                  className="w-full bg-gray-900/50 border border-pink-500/30 rounded px-3 md:px-4 py-2 text-sm text-white placeholder-pink-400/40 focus:outline-none focus:border-pink-500/60"
                />
                <p className="text-xs text-pink-400/50 mt-1">
                  Saved in your browser — reused for all interviews automatically
                </p>
              </div>
            </div>

            {/* 4. Additional Attendees */}
            <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full border border-cyan-400 flex items-center justify-center text-xs bg-cyan-400/10 text-cyan-400 flex-shrink-0">
                  4
                </span>
                <h2 className="text-base md:text-lg font-semibold text-cyan-400 uppercase tracking-wide">
                  Additional Attendees
                </h2>
              </div>
              <p className="text-xs text-cyan-400/50 mb-3">
                Add hiring managers or interviewers — they'll receive the invite
                and can join the Meet
              </p>
              <div className="space-y-2">
                {additionalAttendees.map((attendee, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={attendee}
                      onChange={(e) => updateAttendee(index, e.target.value)}
                      placeholder="interviewer@company.com"
                      className="flex-1 bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-500/60"
                    />
                    {additionalAttendees.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAttendee(index)}
                        className="text-red-400/60 hover:text-red-400 transition-colors p-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAttendee}
                  className="flex items-center gap-1 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors mt-1"
                >
                  <Plus className="w-3 h-3" /> Add another attendee
                </button>
              </div>
            </div>

            {/* 5. Email Content */}
            <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full border border-purple-400 flex items-center justify-center text-xs bg-purple-400/10 text-purple-400 flex-shrink-0">
                  5
                </span>
                <h2 className="text-base md:text-lg font-semibold text-purple-400 uppercase tracking-wide">
                  Email Content
                </h2>
              </div>
              <div className="space-y-3 md:space-y-4">
                <div>
                  <label className="text-xs text-purple-300/70 uppercase tracking-wide block mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-gray-900/50 border border-purple-500/30 rounded px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-300/70 uppercase tracking-wide block mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={9}
                    className="w-full bg-gray-900/50 border border-purple-500/30 rounded px-3 md:px-4 py-2 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500/60 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 6. Sender Settings */}
            <div className="border border-cyan-500/30 rounded-lg p-4 md:p-6 bg-gray-900/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full border border-cyan-400 flex items-center justify-center text-xs bg-cyan-400/10 text-cyan-400 flex-shrink-0">
                  6
                </span>
                <h2 className="text-base md:text-lg font-semibold text-cyan-400 uppercase tracking-wide">
                  Sender Settings
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    disabled={smtpConfiguredFromEnv}
                    className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    disabled={smtpConfiguredFromEnv}
                    className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    disabled={smtpConfiguredFromEnv}
                    className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyan-300/70 uppercase tracking-wide block mb-2">
                    App Password
                  </label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={
                      smtpConfiguredFromEnv
                        ? "Using saved app password"
                        : "Or set SMTP_PASSWORD in .env"
                    }
                    disabled={smtpConfiguredFromEnv}
                    className="w-full bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* 7. Send */}
            <div className="flex items-center gap-2 px-4 md:px-6 py-3 md:py-4">
              <span className="w-6 h-6 rounded-full border border-green-400 flex items-center justify-center text-xs bg-green-400/10 text-green-400 flex-shrink-0">
                7
              </span>
              <h2 className="text-base md:text-lg font-semibold text-green-400 uppercase tracking-wide">
                Send Invite
              </h2>
            </div>

            <button
              type="submit"
              disabled={isSending || isExtractingEmail}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm md:text-base"
            >
              {isSending ? "Sending Invite..." : "• Send Interview Invite"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
