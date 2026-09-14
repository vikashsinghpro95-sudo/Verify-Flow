import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { authMiddleware } from '../middleware/authMiddleware.js';

dotenv.config();

const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_jwt_key_2026_change_in_production';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ValidatorAdmin@2026!';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Permanent login (e.g., 10 years expiration)
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '3650d' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3650 * 24 * 60 * 60 * 1000, // 10 years in ms
    });

    return res.status(200).json({ message: 'Logged in successfully' });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// GET /api/auth/check
router.get('/check', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Authenticated', user: req.user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
