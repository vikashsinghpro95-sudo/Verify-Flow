import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_jwt_key_2026_change_in_production';

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
};
