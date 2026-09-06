import jwt from 'jsonwebtoken';
import { generateToken } from '../lib/utils.js';
import { mergeGuestIntoCustomer } from '../services/cart.js';
import { sendEmail } from '../services/gmail.service.js';
import { logger } from '../lib/logger.js';
import {
  IdentityError,
  authenticateCustomer,
  beginPasswordReset,
  changeCustomerPassword,
  completePasswordReset,
  deleteCustomer,
  findCustomerById,
  findStaffById,
  registerCustomer,
  updateCustomerProfile,
} from '../services/identity.js';
import { signInCustomerWithSupabase } from '../services/supabaseAuth.js';

/*
 * Shopper authentication. The account itself lives in `customers`, and
 * everything that touches a password or a reset token is in
 * services/identity.js — these handlers translate the request and translate the
 * error, as the catalog and cart controllers do.
 *
 * Sign-in responses no longer carry `cart` and `wishlist`. Those were the
 * embedded Mongo arrays and stopped being the cart when carts moved to their
 * own tables; neither frontend read them. The cart is at GET /api/cart.
 */

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
});

const handleError = (error, res, where) => {
  if (error instanceof IdentityError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

/**
 * Adopts whatever the shopper put in their basket before signing in.
 *
 * The merge is best-effort on purpose: a failure here must not turn a
 * successful sign-in into an error response, because the account exists either
 * way and refusing the session would leave them unable to reach the cart at
 * all. It is logged rather than swallowed.
 */
const adoptGuestCart = async (customerId, req, res) => {
  const anonymousId = req.cookies?.anonymousId;
  if (!anonymousId) return;

  try {
    await mergeGuestIntoCustomer(customerId, anonymousId);
    res.clearCookie('anonymousId', cookieOptions());
  } catch (error) {
    logger.error({ err: error, customerId }, 'Could not merge the guest cart on sign-in');
  }
};

export const signup = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber } = req.body;

    const customer = await registerCustomer({ fullName, email, password, phoneNumber });

    generateToken(customer.id, res);
    await adoptGuestCart(customer.id, req, res);

    res.status(201).json(customer);
  } catch (error) {
    handleError(error, res, 'signup');
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await authenticateCustomer(email, password);

    generateToken(customer.id, res);
    await adoptGuestCart(customer.id, req, res);

    res.status(200).json(customer);
  } catch (error) {
    handleError(error, res, 'login');
  }
};

/**
 * Signs a shopper in with a Supabase access token.
 *
 * The frontend does the sign-in with Supabase's own SDK — password, magic link,
 * Google, whatever the project has enabled — and posts the resulting access
 * token here. We verify it with Supabase, find or create the matching row in
 * `customers`, and issue the same session cookie the password path issues.
 *
 * So the rest of the API is untouched: `protectRoute` reads one cookie and does
 * not care which door the shopper came through, and an account with a local
 * password keeps working exactly as before.
 */
export const supabaseSession = async (req, res) => {
  try {
    const accessToken =
      req.body?.accessToken || (req.headers.authorization || '').replace(/^Bearer /i, '');

    const { customer, created } = await signInCustomerWithSupabase(accessToken);

    generateToken(customer.id, res);
    await adoptGuestCart(customer.id, req, res);

    res.status(created ? 201 : 200).json(customer);
  } catch (error) {
    handleError(error, res, 'supabaseSession');
  }
};

export const logout = (req, res) => {
  res.cookie('jwt', '', { ...cookieOptions(), maxAge: 0 });
  res.status(200).json({ message: 'Logged Out successfully' });
};

export const updateProfile = async (req, res) => {
  try {
    const { username, email, phoneNumber } = req.body;
    res.status(200).json(await updateCustomerProfile(req.user.id, { username, email, phoneNumber }));
  } catch (error) {
    handleError(error, res, 'updateProfile');
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const deleted = await deleteCustomer(req.user.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Account not found or already deleted.' });
    }

    res.clearCookie('jwt', cookieOptions());
    res.status(200).json({ message: `your account deleted successfully.` });
  } catch (error) {
    handleError(error, res, 'deleteAccount');
  }
};

/**
 * Who the caller is, according to their cookie.
 *
 * Both frontends poll this on load, so it answers for either kind of principal:
 * the token says which table to read, and the wrong table is never queried.
 * Every failure clears the cookie — a token this endpoint refuses is one no
 * other endpoint will accept either, and leaving it in place means the client
 * retries the same rejection on every page load.
 */
export const checkAuth = async (req, res) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated: No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({ message: 'Not authenticated: Invalid or expired token.' });
    }

    if (decoded.role !== 'admin' && decoded.role !== 'user') {
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({ message: 'Not authenticated: Invalid role in token.' });
    }

    const principal =
      decoded.role === 'admin'
        ? await findStaffById(decoded.userId)
        : await findCustomerById(decoded.userId);

    if (!principal) {
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({
        message: 'Not authenticated: User/Admin account not found in database.',
      });
    }

    // A deactivated operator holding a valid token is still refused: the token
    // outlives the decision to revoke access by up to fifteen days.
    if (decoded.role === 'admin' && principal.isActive === false) {
      res.clearCookie('jwt', cookieOptions());
      return res.status(401).json({ message: 'Not authenticated: This account has been deactivated.' });
    }

    return res.status(200).json({ ...principal, role: decoded.role === 'admin' ? 'admin' : 'user' });
  } catch (error) {
    return handleError(error, res, 'checkAuth');
  }
};

/**
 * @desc Request a password reset link (sends email with token)
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  // One response for both outcomes, so this cannot be used to find out which
  // addresses have accounts.
  const generic = {
    message:
      'If an account with that email exists, a password reset link has been sent.',
  };

  if (!email) {
    return res.status(400).json({ message: 'Please provide an email address.' });
  }

  try {
    const reset = await beginPasswordReset(email);
    if (!reset) return res.status(200).json(generic);

    const { customer, token } = reset;
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const htmlContent = `
      <p>Hello ${customer.username || customer.email},</p>
      <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
      <p>Please click on the following link to reset your password:</p>
      <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p><code>${resetUrl}</code></p>
      <p>This link is valid for 1 hour. After that, you will need to request a new one.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <p>Thank you,</p>
      <p>EM Furniture and Interior Team</p>
    `;

    try {
      await sendEmail({
        to: customer.email,
        subject: 'Password Reset Request for Your Account',
        text: `Reset your password using this link: ${resetUrl}`,
        html: htmlContent,
      });
      logger.info({ email: customer.email }, 'Password reset email sent');
    } catch (emailError) {
      logger.error({ err: emailError }, 'Error sending password reset email');
    }

    res.status(200).json(generic);
  } catch (error) {
    handleError(error, res, 'forgotPassword');
  }
};

/**
 * @desc Reset user password using a token
 * @route POST /api/auth/reset-password/:token
 * @access Public
 */
export const resetPassword = async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'Please provide a new password.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    await completePasswordReset(req.params.token, newPassword);
    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    handleError(error, res, 'resetPassword');
  }
};

/**
 * @desc Change user password (for authenticated users)
 * @route PUT /api/auth/change-password
 * @access Private (requires authentication middleware)
 */
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide both old and new passwords.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  try {
    await changeCustomerPassword(req.user.id, oldPassword, newPassword);
    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    handleError(error, res, 'changePassword');
  }
};
