import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailContent } from './mail-templates';

export interface MailResult { sent: boolean; error?: string }

/**
 * SMTP delivery. Configured only through environment variables (SMTP_HOST/PORT/USER/PASS/FROM/REPLY_TO);
 * credentials never live in code. Sending never throws: callers get `{ sent: false }` and keep working,
 * because an unreachable mail server must not break invitations or issue updates.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  private getTransport() {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
      const ignoreTls = process.env.SMTP_IGNORE_TLS === 'true';
      // Escape hatch for a mail server with a self-signed certificate; the SMTP password is then exposed to interception.
      if (ignoreTls) this.logger.warn('SMTP_IGNORE_TLS=true: TLS certificates are not verified. Use only temporarily; fix the mail server certificate or use a managed SMTP provider.');
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        requireTLS: !secure && !ignoreTls,
        tls: ignoreTls ? { rejectUnauthorized: false } : undefined,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
    return this.transporter;
  }

  /** Verifies the SMTP connection and credentials without sending any message. */
  async verify(): Promise<MailResult> {
    if (!this.isConfigured()) return { sent: false, error: 'Email is not configured' };
    try { await this.getTransport().verify(); return { sent: true }; }
    catch (error) { return { sent: false, error: (error as Error).message }; }
  }

  async send(to: string, content: EmailContent): Promise<MailResult> {
    if (!this.isConfigured()) return { sent: false, error: 'Email is not configured' };
    try {
      await this.getTransport().sendMail({
        from: process.env.SMTP_FROM || `REKA <${process.env.SMTP_USER}>`,
        replyTo: process.env.SMTP_REPLY_TO || undefined,
        to, subject: content.subject, text: content.text, html: content.html,
      });
      return { sent: true };
    } catch (error) {
      this.logger.warn(`Email delivery failed: ${(error as Error).message}`);
      return { sent: false, error: 'Email delivery failed' };
    }
  }
}
