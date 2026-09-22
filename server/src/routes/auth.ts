import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fintrack_super_secret_jwt_key_2026';
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    currency_preference?: string;
    avatar_url?: string;
    encryption_salt: string;
    email_verified?: boolean;
    data_retention_days?: number | null;
    ai_consent?: boolean;
    ai_provider?: string;
  };
}

/**
 * Helper to set secure httpOnly session cookie and generate JWT token
 */
function issueSession(res: Response, user: { id: number; email: string; name: string }) {
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };
  res.cookie('fintrack_session', token, cookieOptions);
  res.cookie('serendib_session', token, cookieOptions);

  return token;
}

/**
 * Strict authentication middleware: requires valid Bearer token or httpOnly cookie.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if ((req as any).cookies && ((req as any).cookies.fintrack_session || (req as any).cookies.serendib_session)) {
    token = (req as any).cookies.fintrack_session || (req as any).cookies.serendib_session;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; name: string };
    const user = await db.queryOne(
      'SELECT id, email, name, currency_preference, avatar_url, encryption_salt, email_verified, data_retention_days, ai_consent, ai_provider FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!user) {
      res.status(401).json({ error: 'User account no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// 1. POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Name must be at least 2 characters long' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'A valid email address is required' });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  try {
    const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists' });
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const encryptionSalt = crypto.randomBytes(16).toString('hex');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const isVerifiedInitially = !REQUIRE_EMAIL_VERIFICATION;

    const result = await db.execute(
      `INSERT INTO users (
        name, email, password_hash, encryption_salt,
        email_verified, verification_token, verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        encryptionSalt,
        isVerifiedInitially ? (db.isPostgres ? true : 1) : (db.isPostgres ? false : 0),
        verificationToken,
        verificationExpires.toISOString(),
      ]
    );

    const userId = Number(result.lastInsertId);

    // Create default starter accounts
    await db.execute(
      'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
      [`acc_${userId}_checking`, userId, 'Checking Account', 'checking', 'USD', 'Primary Bank']
    );
    await db.execute(
      'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
      [`acc_${userId}_credit`, userId, 'Credit Card', 'credit', 'USD', 'Primary Card']
    );

    // Log verification link for development/audit
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:5001'}/api/auth/verify-email?token=${verificationToken}`;
    console.log(`✉️ Verification link for ${cleanEmail}: ${verificationUrl}`);

    const userObj = { id: userId, email: cleanEmail, name: cleanName, encryption_salt: encryptionSalt, email_verified: isVerifiedInitially };
    const token = issueSession(res, userObj);

    res.status(201).json({
      user: userObj,
      token,
      message: isVerifiedInitially
        ? 'Account registered successfully'
        : 'Registration successful. Please verify your email address to activate all features.',
      verificationUrl: !isVerifiedInitially && process.env.NODE_ENV !== 'production' ? verificationUrl : undefined,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
  }
});

// 2. GET & POST /api/auth/verify-email
router.all('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token || req.body.token;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Verification token is required' });
    return;
  }

  try {
    const user = await db.queryOne(
      'SELECT id, email, verification_expires FROM users WHERE verification_token = $1',
      [token]
    );

    if (!user) {
      res.status(400).json({ error: 'Invalid or already used verification token' });
      return;
    }

    if (user.verification_expires && new Date(user.verification_expires) < new Date()) {
      res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
      return;
    }

    await db.execute(
      'UPDATE users SET email_verified = $1, verification_token = NULL, verification_expires = NULL WHERE id = $2',
      [db.isPostgres ? true : 1, user.id]
    );

    if (req.method === 'GET') {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>FinTrack - Email Verified</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #e8ebe6;">
            <div style="background: white; padding: 40px; border-radius: 24px; max-width: 450px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <h2 style="color: #0e0f0c; margin-bottom: 8px;">Email Verified!</h2>
              <p style="color: #454745; font-size: 14px;">Your FinTrack account is now fully verified and active.</p>
              <a href="/" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #9fe870; color: #0e0f0c; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 14px;">Go to Dashboard</a>
            </div>
          </body>
        </html>
      `);
    } else {
      res.json({ success: true, message: 'Email verified successfully' });
    }
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// 3. POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    const user = await db.queryOne(
      'SELECT id, email, password_hash, name, encryption_salt, email_verified, currency_preference FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
      res.status(403).json({ error: 'Please verify your email address before logging in' });
      return;
    }

    const userObj = {
      id: user.id,
      email: user.email,
      name: user.name,
      currency_preference: user.currency_preference || 'USD',
      encryption_salt: user.encryption_salt,
      email_verified: Boolean(user.email_verified),
    };

    const token = issueSession(res, userObj);

    res.json({
      user: userObj,
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to process login. Please try again.' });
  }
});

// 4. POST /api/auth/forgot-password & POST /api/auth/reset-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const user = await db.queryOne('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.execute(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [resetToken, resetExpires.toISOString(), user.id]
      );

      const resetUrl = `${process.env.APP_URL || 'http://localhost:5001'}/reset-password?token=${resetToken}`;
      console.log(`🔑 Password reset link for ${user.email}: ${resetUrl}`);
    }

    // Always respond with success to prevent user enumeration
    res.json({
      message: 'If an account exists with that email, a password reset link has been dispatched.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'A valid token and a password with at least 6 characters are required' });
    return;
  }

  try {
    const user = await db.queryOne(
      'SELECT id, password_reset_expires FROM users WHERE password_reset_token = $1',
      [token]
    );

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token' });
      return;
    }

    if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
      res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.execute(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ success: true, message: 'Password has been successfully updated. You may now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// 5. POST /api/auth/google — Google OAuth Sign-In
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { credential, idToken } = req.body;
  const tokenToVerify = credential || idToken;

  if (!tokenToVerify) {
    res.status(400).json({ error: 'Google credential / ID token is required' });
    return;
  }

  try {
    // Verify token with Google's public tokeninfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`);
    if (!googleRes.ok) {
      res.status(401).json({ error: 'Invalid Google authentication token' });
      return;
    }

    const payload = (await googleRes.json()) as {
      email?: string;
      name?: string;
      sub?: string;
      picture?: string;
      email_verified?: string | boolean;
      aud?: string;
    };

    if (!payload.email) {
      res.status(400).json({ error: 'Google token does not contain an email address' });
      return;
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const cleanName = payload.name || payload.email.split('@')[0];

    let user = await db.queryOne('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    if (!user) {
      const encryptionSalt = crypto.randomBytes(16).toString('hex');
      const insertRes = await db.execute(
        `INSERT INTO users (
          email, name, encryption_salt, avatar_url, email_verified
        ) VALUES ($1, $2, $3, $4, $5)`,
        [cleanEmail, cleanName, encryptionSalt, payload.picture || null, db.isPostgres ? true : 1]
      );
      const userId = Number(insertRes.lastInsertId);

      // Create initial accounts
      await db.execute(
        'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
        [`acc_${userId}_primary`, userId, 'Primary Account', 'checking', 'USD', 'Google Connected']
      );

      user = {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        currency_preference: 'USD',
        avatar_url: payload.picture,
        encryption_salt: encryptionSalt,
        email_verified: true,
      };
    }

    const token = issueSession(res, user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency_preference: user.currency_preference || 'USD',
        avatar_url: user.avatar_url,
        encryption_salt: user.encryption_salt,
        email_verified: true,
      },
      token,
    });
  } catch (err: any) {
    console.error('Google OAuth error:', err);
    res.status(500).json({ error: 'Google sign-in failed. Please try again.' });
  }
});

// 6. POST /api/auth/apple — Apple Sign-In
router.post('/apple', async (req: Request, res: Response): Promise<void> => {
  const { identityToken, user: appleUserData } = req.body;
  if (!identityToken) {
    res.status(400).json({ error: 'Apple identity token is required' });
    return;
  }

  try {
    // ⚠️  SECURITY NOTE: jwt.decode() does NOT verify the token signature.
    // For production, Apple identity tokens should be verified against Apple's
    // public JWKS endpoint: https://appleid.apple.com/auth/keys
    // Using an unverified token is safe only when Apple OAuth flow guarantees
    // it originates from Apple's servers (i.e., it was received directly from
    // Apple's authorization endpoint on the client, not user-supplied).
    // TODO: Add JWKS-based verification using `jose` or `apple-signin-auth` package
    //       before enabling Apple Sign-In in a regulated production environment.
    const decoded = jwt.decode(identityToken) as { email?: string; sub?: string } | null;
    if (!decoded || !decoded.sub) {
      res.status(400).json({ error: 'Invalid Apple identity token payload' });
      return;
    }

    const email = decoded.email || `${decoded.sub}@privaterelay.appleid.com`;
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = appleUserData?.name
      ? `${appleUserData.name.firstName || ''} ${appleUserData.name.lastName || ''}`.trim() || 'Apple User'
      : 'Apple User';

    let user = await db.queryOne('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    if (!user) {
      const encryptionSalt = crypto.randomBytes(16).toString('hex');
      const insertRes = await db.execute(
        `INSERT INTO users (
          email, name, encryption_salt, email_verified
        ) VALUES ($1, $2, $3, $4)`,
        [cleanEmail, cleanName, encryptionSalt, db.isPostgres ? true : 1]
      );
      const userId = Number(insertRes.lastInsertId);

      await db.execute(
        'INSERT INTO accounts (id, user_id, name, type, currency, institution) VALUES ($1, $2, $3, $4, $5, $6)',
        [`acc_${userId}_primary`, userId, 'Apple Pay Account', 'checking', 'USD', 'Apple Connected']
      );

      user = {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        currency_preference: 'USD',
        encryption_salt: encryptionSalt,
        email_verified: true,
      };
    }

    const token = issueSession(res, user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency_preference: user.currency_preference || 'USD',
        encryption_salt: user.encryption_salt,
        email_verified: true,
      },
      token,
    });
  } catch (err) {
    console.error('Apple Sign-In error:', err);
    res.status(500).json({ error: 'Apple sign-in failed' });
  }
});

// 7. POST /api/auth/demo — Instant Demo Session
router.post('/demo', async (req: Request, res: Response): Promise<void> => {
  try {
    let demoUser = await db.queryOne('SELECT * FROM users WHERE email = $1', ['demo@fintrack.app']);
    if (!demoUser) {
      demoUser = await db.queryOne('SELECT * FROM users WHERE email = $1', ['demo@serendib.app']);
    }
    if (!demoUser) {
      res.status(404).json({ error: 'Demo account not initialized' });
      return;
    }

    const userObj = {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      currency_preference: demoUser.currency_preference || 'USD',
      encryption_salt: demoUser.encryption_salt,
      email_verified: true,
    };

    const token = issueSession(res, userObj);

    res.json({
      user: userObj,
      token,
    });
  } catch (err) {
    console.error('Demo auth error:', err);
    res.status(500).json({ error: 'Unable to start demo session' });
  }
});

// 8. POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('fintrack_session', { path: '/' });
  res.clearCookie('serendib_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

// 9. GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
