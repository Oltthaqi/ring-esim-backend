import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import { SendEmailDTO } from './dto/send-email.dto';

/** .env values are strings; `secure: "false"` must not be treated as true. */
function parseEnvBool(
  raw: string | boolean | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined || raw === '') return defaultValue;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return defaultValue;
}

function parseEnvInt(
  raw: string | number | undefined,
  defaultValue: number,
): number {
  if (raw === undefined || raw === '') return defaultValue;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : defaultValue;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private logoUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', '') || '';
    const port = parseEnvInt(this.configService.get('SMTP_PORT'), 587);
    const secureExplicit = this.configService.get<string | boolean | undefined>(
      'SMTP_SECURE',
    );
    const secure =
      secureExplicit === undefined || secureExplicit === ''
        ? port === 465
        : parseEnvBool(secureExplicit, port === 465);

    const connectionTimeout = parseEnvInt(
      this.configService.get('SMTP_CONNECTION_TIMEOUT_MS'),
      60_000,
    );
    const greetingTimeout = parseEnvInt(
      this.configService.get('SMTP_GREETING_TIMEOUT_MS'),
      30_000,
    );
    const socketTimeout = parseEnvInt(
      this.configService.get('SMTP_SOCKET_TIMEOUT_MS'),
      60_000,
    );
    const forceIpv4 = parseEnvBool(
      this.configService.get('SMTP_FORCE_IPV4'),
      false,
    );

    this.logger.log(
      `SMTP config: host=${host || '(empty)'} port=${port} secure=${secure} ` +
        `timeouts(ms)=${connectionTimeout}/${greetingTimeout}/${socketTimeout} forceIpv4=${forceIpv4}`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: this.configService.get<string>('SMTP_USERNAME', ''),
        pass: this.configService.get<string>('SMTP_PASSWORD', ''),
      },
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      ...(forceIpv4 ? { family: 4 as const } : {}),
    });
  }

  async sendEmail(
    sendEmailDTO: SendEmailDTO & {
      attachments?: SMTPTransport.Attachment[];
    },
  ): Promise<SMTPTransport.SentMessageInfo> {
    const mailOptions: SMTPTransport.Options = {
      from: this.configService.get<string>('SMTP_EMAIL', ''),
      to: sendEmailDTO.to,
      subject: sendEmailDTO.subject,
      html: sendEmailDTO.body,
      // Let Nodemailer set multipart headers automatically
      attachments: sendEmailDTO.attachments,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await this.transporter.sendMail(mailOptions);
  }

  async sendInviteEmail(
    sendEmailDTO: SendEmailDTO,
    link: string,
    company_name: string,
  ): Promise<SMTPTransport.SentMessageInfo> {
    const templatePath = join(__dirname, 'templates', 'invite-user.hbs');
    const source = await fsPromises.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(source);

    const html = template({
      inviteLink: link,
      company_name: company_name,
    });

    return this.sendEmail({
      to: sendEmailDTO.to,
      subject: sendEmailDTO.subject,
      body: html,
    });
  }

  async sendVerificationCodeEmail(
    email: string,
    code: string,
  ): Promise<SMTPTransport.SentMessageInfo> {
    const subject = 'Email Verification Code';
    this.logger.log(
      `[VERIFICATION EMAIL] Sending verification code to=${email} (code length=${code.length}, not logged for security)`,
    );

    const html = `
    <p>Hi ${email},</p>
    <p>Your verification code is: <strong>${code}</strong></p>
    <p>This code will expire in 10 minutes.</p>
    <p style='margin-top: 20px; font-size: 14px; color: #6b7280;'>Ring eSIM</p>
  `;

    const info = await this.sendEmail({
      to: email,
      subject,
      body: html,
    });

    // SMTP accepted the message; inbox delivery depends on recipient provider/spam filters.
    this.logger.log(
      `[VERIFICATION EMAIL] SMTP send succeeded to=${email} messageId=${info.messageId ?? 'n/a'} response=${info.response ?? 'n/a'}`,
    );

    return info;
  }

  async sendOrderCompletionEmail(
    email: string,
    orderData: {
      orderNumber: string;
      packageName: string;
      dataVolume: string;
      validityDays: number;
      amount: number;
      currency: string;
      qrCodeUrl?: string;
      qrCodeText?: string;
      logoUrl?: string;
    },
  ): Promise<SMTPTransport.SentMessageInfo> {
    const templatePath = join(__dirname, 'templates', 'order-completion.hbs');
    const source = await fsPromises.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(source);

    // Generate QR code as PNG buffer for inline attachment
    let qrPngBuffer: Buffer | null = null;
    if (orderData.qrCodeText) {
      try {
        qrPngBuffer = await QRCode.toBuffer(orderData.qrCodeText, {
          width: 250,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
      } catch (error) {
        console.error(
          `Failed to generate QR code for order ${orderData.orderNumber}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Prepare template data with CID reference
    const html = template({
      orderNumber: orderData.orderNumber,
      packageName: orderData.packageName,
      dataVolume: orderData.dataVolume,
      validityDays: orderData.validityDays,
      amount: orderData.amount,
      currency: orderData.currency,
      logoUrl: orderData.logoUrl,
      hasQrImage: !!qrPngBuffer,
      qrCodeCid: 'qrCodeImage',
      qrCodeText: orderData.qrCodeText,
    });

    const attachments: SMTPTransport.Attachment[] = qrPngBuffer
      ? [
          {
            filename: 'qrcode.png',
            content: qrPngBuffer,
            contentType: 'image/png',
            cid: 'qrCodeImage',
            encoding: 'base64',
          },
        ]
      : [];

    if (attachments.length > 0) {
      const firstAttachment = attachments[0] as {
        cid?: string;
        filename?: string;
      };
    }

    return this.sendEmail({
      to: email,
      subject: 'Kartela juaj eSIM është gati!',
      body: html,
      attachments,
    });
  }

  setLogoUrl(logoUrl: string): void {
    this.logoUrl = logoUrl;
  }

  getLogoUrl(): string | undefined {
    return this.logoUrl;
  }
}
