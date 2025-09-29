// services/gmail.service.js
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

// Set credentials
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Initialize Gmail API
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Create email message in RFC 2822 format
 */
const createMessage = (to, subject, textContent, htmlContent, from) => {
  const fromEmail = from || process.env.EMAIL_USER;
  const boundary = '----=_Part_0_' + Date.now();
  
  const message = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textContent,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlContent,
    '',
    `--${boundary}--`,
  ].join('\n');

  // Encode to base64url
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return encodedMessage;
};

/**
 * Send email using Gmail API
 */
export const sendEmail = async ({ to, subject, text, html, from }) => {
  try {
    const rawMessage = createMessage(to, subject, text, html, from);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    console.log('✅ Email sent successfully:', response.data.id);
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
    };
  } catch (error) {
    console.error('❌ Gmail API error:', error.message);
    
    if (error.code === 401) {
      console.error('Authentication failed - check OAuth2 tokens');
    } else if (error.code === 403) {
      console.error('Permission denied - check Gmail API is enabled');
    } else if (error.code === 429) {
      console.error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
};

/**
 * Verify Gmail API connection
 */
export const verifyConnection = async () => {
  try {
    const response = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail API connected:', response.data.emailAddress);
    return true;
  } catch (error) {
    console.error('❌ Gmail API connection failed:', error.message);
    return false;
  }
};

export default { sendEmail, verifyConnection };