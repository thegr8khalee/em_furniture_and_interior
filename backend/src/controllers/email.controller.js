// backend/controllers/contactController.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

/**
 * @desc    Send a contact form email
 * @route   POST /api/contact
 * @access  Public
 * @param   {Object} req - Express request object (expects { name, email, subject, message } in body)
 * @param   {Object} res - Express response object
 */
export const sendContactEmail = async (req, res) => {
  const { name, email, phoneNumber, subject, message } = req.body;

  // 1. Basic input validation
  if (!name || !email || !phoneNumber || !subject || !message) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  // 2. Configure Nodemailer transporter
  // Use your email service provider's SMTP settings.
  // Example for Gmail (less secure app access must be enabled or use App Passwords):
  // For production, consider a dedicated email service like SendGrid, Mailgun, AWS SES.
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Or 'outlook', 'yahoo', or specific host/port for other SMTP
    auth: {
      user: process.env.EMAIL_USER, // Your email address from .env
      pass: process.env.EMAIL_PASS, // Your email password or app password from .env
    },
  });

  // 3. Define email options
  const mailOptions = {
    from: `"${name}" <${email}>`, // Sender's name and email
    to: process.env.RECEIVING_EMAIL, // The email address where you want to receive messages
    subject: `Contact Form: ${subject}`,
    html: `
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone Number:</strong> ${phoneNumber}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `,
  };

  // 4. Send the email
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res
      .status(500)
      .json({ message: 'Failed to send message. Please try again later.' });
  }
};
