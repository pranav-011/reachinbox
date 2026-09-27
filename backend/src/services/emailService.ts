import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter: nodemailer.Transporter | null = null;
let etherealTransporter: nodemailer.Transporter | null = null;
let testAccount: nodemailer.TestAccount | null = null;

export async function getEtherealTransporter(): Promise<nodemailer.Transporter> {
  if (etherealTransporter) {
    return etherealTransporter;
  }

  let user = config.ethereal.user;
  let pass = config.ethereal.pass;

  if (!user || !pass) {
    if (!testAccount) {
      console.log('🔄 Generating Ethereal test account for previews...');
      testAccount = await nodemailer.createTestAccount();
    }
    user = testAccount.user;
    pass = testAccount.pass;
  }

  etherealTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  return etherealTransporter;
}

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter;
  }

  // Check if real SMTP credentials are provided
  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    console.log(`📡 Using Real SMTP Provider: ${config.smtp.host}:${config.smtp.port} (${config.smtp.user})`);
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    return transporter;
  }

  return getEtherealTransporter();
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  etherealPreviewUrl?: string;
  error?: string;
}

export async function sendEmail({
  from,
  to,
  subject,
  body,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const mailer = await getTransporter();

    const isRealSmtp = Boolean(config.smtp.host && config.smtp.user);
    const senderFrom = config.smtp.from || from;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">${subject}</h2>
        <div style="white-space: pre-wrap;">${body}</div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 12px 0;" />
        <p style="font-size: 11px; color: #999;">Sent via ReachInbox Scheduler Service</p>
      </div>
    `;

    // Send email via primary transporter (Gmail or Ethereal)
    const info = await mailer.sendMail({
      from: `"${senderFrom.split('@')[0]}" <${senderFrom}>`,
      to,
      subject,
      text: body,
      html: htmlBody,
    });

    let etherealPreviewUrl: string | undefined = undefined;

    if (isRealSmtp) {
      // Real SMTP sent! Also mirror to Ethereal to produce a live web preview link for UI & evaluation
      try {
        const etherealMailer = await getEtherealTransporter();
        const etherealInfo = await etherealMailer.sendMail({
          from: `"${senderFrom.split('@')[0]}" <${senderFrom}>`,
          to,
          subject,
          text: body,
          html: htmlBody,
        });
        const previewUrl = nodemailer.getTestMessageUrl(etherealInfo);
        etherealPreviewUrl = previewUrl ? previewUrl.toString() : undefined;
      } catch (ethErr: any) {
        console.warn('⚠️ Could not generate secondary Ethereal preview link:', ethErr.message);
      }
    } else {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      etherealPreviewUrl = previewUrl ? previewUrl.toString() : undefined;
    }

    console.log(`✉️ Email sent successfully to ${to}! Message ID: ${info.messageId}`);
    if (etherealPreviewUrl) {
      console.log(`🔗 Ethereal preview link: ${etherealPreviewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      etherealPreviewUrl,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown SMTP error',
    };
  }
}
