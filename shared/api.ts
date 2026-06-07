/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Response type for /api/process-resume
 */
export interface ProcessResumeResponse {
  email: string;
  fileName: string;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  from: string;
  to: string;
}

export interface SmtpConfigResponse {
  host: string;
  port: string;
  user: string;
  passwordConfigured: boolean;
}
