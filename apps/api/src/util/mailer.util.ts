import nodemailer, { Transporter, SendMailOptions }  from 'nodemailer';
import { EMAIL_CONFIG } from '../config';

interface MailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

const transporter : Transporter = nodemailer.createTransport({
  service: EMAIL_CONFIG.service,
  auth: {
    user: EMAIL_CONFIG.user,
    pass: EMAIL_CONFIG.pass,
  },
});

const sendMail = async ({ to, subject, text, html } : MailOptions) : Promise<void> => {
  const mailOptions = {
    from: EMAIL_CONFIG.user,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
};

export default sendMail; 