import Email from 'email-templates';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let transport;

if (process.env.EMAIL_TRANSPORT === 'smtp') {
  transport = {
    host: process.env.EMAIL_SMTP_HOST,
    port: process.env.EMAIL_SMTP_PORT,
    secure: process.env.EMAIL_SMTP_PORT === 465,
    auth: {
      user: process.env.EMAIL_SMTP_USERNAME,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  };
} else if (process.env.EMAIL_TRANSPORT === 'ses') {
  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
  const sesClient = new SESv2Client();
  transport = nodemailer.createTransport({
    SES: { sesClient, SendEmailCommand },
  });
} else {
  transport = {
    jsonTransport: true,
  };
}

if (process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line import/no-extraneous-dependencies
  transport = (await import('nodemailer-mock')).createTransport(transport);
}

const email = new Email({
  message: {
    from: `${process.env.VITE_SITE_TITLE} <${process.env.EMAIL_FROM_ADDRESS}>`,
  },
  send: true,
  transport,
  views: {
    root: path.resolve(__dirname),
    options: {
      extension: 'ejs',
    },
  },
  juice: true,
  juiceResources: {
    preserveImportant: true,
    webResources: {
      relativeTo: __dirname,
    },
  },
});

export default email;
