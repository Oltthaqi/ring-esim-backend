import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import { SendEmailDTO } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private logoUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', ''),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USERNAME', ''),
        pass: this.configService.get<string>('SMTP_PASSWORD', ''),
      },
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
    const html = `
    <p>Hi ${email},</p>
    <p>Your verification code is: <strong>${code}</strong></p>
    <p>This code will expire in 10 minutes.</p>
    <p style='margin-top: 20px; font-size: 14px; color: #6b7280;'>Ring eSIM</p>
  `;

    return this.sendEmail({
      to: email,
      subject,
      body: html,
    });
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
