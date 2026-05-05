import express from 'express';
import bcrypt from 'bcrypt';
import db, {
    seedDefaultJarsForUser,
    getUserByEmail,
    getUserByUsername,
    setUserVerified,
    setUserEmail,
    updateUserPassword,
    createOtp,
    verifyOtp,
    generateOtp,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from './database.js';
import jwt from 'jsonwebtoken';
import { sendOtpEmail } from './emailService.js';

// Local auth middleware for protected auth routes
const JWT_SECRET_LOCAL = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
    try {
        (req as any).user = jwt.verify(token, JWT_SECRET_LOCAL);
        next();
    } catch {
        return res.status(403).json({ error: 'Phiên đã hết hạn, vui lòng đăng nhập lại' });
    }
};

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

// ─── SIGNUP ─────────────────────────────────────────────────────────────────
// Step 1: Register → save unverified user → send OTP
router.post('/signup', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }

        // Check duplicate username
        const existingUsername = getUserByUsername(username);
        if (existingUsername) {
            return res.status(400).json({ error: 'Tên tài khoản đã tồn tại' });
        }

        // Check duplicate email
        const existingEmail = getUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'Email này đã được đăng ký' });
        }

        const id = Date.now().toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user as unverified
        db.prepare('INSERT INTO users (id, username, password, email, is_verified) VALUES (?, ?, ?, ?, 0)')
            .run(id, username, hashedPassword, email.toLowerCase().trim());

        // Seed default jars for user
        seedDefaultJarsForUser(id);

        // Generate and send OTP
        const otp = generateOtp();
        createOtp(email.toLowerCase().trim(), otp, 'verify');
        await sendOtpEmail(email, otp, 'verify', username);

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công! Mã OTP đã gửi về email.',
            email: email.toLowerCase().trim(),
        });
    } catch (err: any) {
        console.error('[Signup Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Step 2: Verify OTP → activate account
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Thiếu thông tin' });

        const result = verifyOtp(email.toLowerCase().trim(), otp.trim(), 'verify');
        if (!result.valid) return res.status(400).json({ error: result.reason });

        const user = getUserByEmail(email.toLowerCase().trim());
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

        setUserVerified(user.id);

        // Issue JWT
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Resend OTP (for signup verification)
router.post('/resend-otp', async (req, res) => {
    try {
        const { email, type } = req.body;
        if (!email) return res.status(400).json({ error: 'Thiếu email' });

        const otpType = type === 'reset' ? 'reset' : 'verify';
        const user = getUserByEmail(email.toLowerCase().trim());
        if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });

        const otp = generateOtp();
        createOtp(email.toLowerCase().trim(), otp, otpType);
        await sendOtpEmail(email, otp, otpType, user.username);

        res.json({ success: true, message: 'Mã OTP mới đã được gửi' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản và mật khẩu' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

        if (!user) {
            return res.status(401).json({ error: 'Tên tài khoản hoặc mật khẩu không đúng' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Tên tài khoản hoặc mật khẩu không đúng' });
        }

        // Check if account is verified (only for users who have email set)
        if (user.email && !user.is_verified) {
            return res.status(403).json({
                error: 'Tài khoản chưa được xác minh',
                needsVerification: true,
                email: user.email,
            });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
// Step 1: Request OTP via email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' });

        const user = getUserByEmail(email.toLowerCase().trim());
        // Always respond success to avoid email enumeration
        if (!user) {
            return res.json({ success: true, message: 'Nếu email tồn tại, mã OTP đã được gửi' });
        }

        const otp = generateOtp();
        createOtp(email.toLowerCase().trim(), otp, 'reset');
        await sendOtpEmail(email, otp, 'reset', user.username);

        res.json({ success: true, message: 'Mã OTP đã được gửi về email của bạn' });
    } catch (err: any) {
        console.error('[Forgot Password Error]', err.message);
        res.status(500).json({ error: 'Không thể gửi email, thử lại sau' });
    }
});

// Step 2: Verify reset OTP (no password change yet)
router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Thiếu thông tin' });

        const result = verifyOtp(email.toLowerCase().trim(), otp.trim(), 'reset');
        if (!result.valid) return res.status(400).json({ error: result.reason });

        // Issue a short-lived reset token
        const user = getUserByEmail(email.toLowerCase().trim());
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

        const resetToken = jwt.sign({ userId: user.id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '10m' });
        res.json({ success: true, resetToken });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Step 3: Set new password using reset token
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

        let payload: any;
        try {
            payload = jwt.verify(resetToken, JWT_SECRET);
        } catch {
            return res.status(400).json({ error: 'Phiên đặt lại đã hết hạn, vui lòng thử lại' });
        }

        if (payload.purpose !== 'reset') {
            return res.status(400).json({ error: 'Token không hợp lệ' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        updateUserPassword(payload.userId, hashed);

        res.json({ success: true, message: 'Mật khẩu đã được cập nhật thành công!' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CHANGE PASSWORD (must be logged in, no OTP needed) ──────────────────────
router.put('/change-password', requireAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = (req as any).user.userId;

        if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });

        const hashed = await bcrypt.hash(newPassword, 10);
        updateUserPassword(userId, hashed);

        res.json({ success: true, message: 'Mật khẩu đã được cập nhật thành công!' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── REQUEST EMAIL CHANGE — send OTP to the NEW email ────────────────────────
router.post('/change-email/request', requireAuth, async (req, res) => {
    try {
        const { newEmail } = req.body;
        const userId = (req as any).user.userId;

        if (!newEmail) return res.status(400).json({ error: 'Vui lòng nhập email mới' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({ error: 'Email không hợp lệ' });

        const normalizedEmail = newEmail.toLowerCase().trim();

        // Check if already taken by another user
        const existing = getUserByEmail(normalizedEmail);
        if (existing && existing.id !== userId) return res.status(400).json({ error: 'Email này đã được sử dụng bởi tài khoản khác' });

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        if (user.email === normalizedEmail) return res.status(400).json({ error: 'Đây đã là email hiện tại của bạn' });

        const otp = generateOtp();
        createOtp(normalizedEmail, otp, 'verify');
        await sendOtpEmail(newEmail, otp, 'verify', user.username);

        res.json({ success: true, message: 'Mã OTP đã được gửi đến email mới của bạn' });
    } catch (err: any) {
        console.error('[Change Email Request Error]', err.message);
        res.status(500).json({ error: 'Không thể gửi email, thử lại sau' });
    }
});

// ─── VERIFY EMAIL CHANGE OTP — update DB + issue new JWT ─────────────────────
router.post('/change-email/verify', requireAuth, async (req, res) => {
    try {
        const { newEmail, otp } = req.body;
        const userId = (req as any).user.userId;

        if (!newEmail || !otp) return res.status(400).json({ error: 'Thiếu thông tin' });

        const normalizedEmail = newEmail.toLowerCase().trim();
        const result = verifyOtp(normalizedEmail, otp.trim(), 'verify');
        if (!result.valid) return res.status(400).json({ error: result.reason });

        // Update email in DB
        setUserEmail(userId, normalizedEmail);

        // Issue fresh JWT with updated user info
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        const newToken = jwt.sign({ userId, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token: newToken,
            user: { id: userId, username: user.username, email: normalizedEmail },
            message: 'Email đã được cập nhật thành công!'
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
// ── Notifications API ────────────────────────────────────────────────────────
router.get('/notifications', requireAuth, (req: any, res) => {
    try {
        const notifications = getNotifications(req.user.userId);
        res.json({ success: true, notifications });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/notifications/:id/read', requireAuth, (req: any, res) => {
    try {
        const info = markNotificationRead(req.params.id, req.user.userId);
        res.json({ success: true, updated: info.changes });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/notifications/read-all', requireAuth, (req: any, res) => {
    try {
        const info = markAllNotificationsRead(req.user.userId);
        res.json({ success: true, updated: info.changes });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
