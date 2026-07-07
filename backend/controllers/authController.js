import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

// Shared cookie options so register/login/logout can never drift out of sync with each other
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required cross-domain on AWS; 'lax' is fine for same-origin localhost
  maxAge: 30 * 24 * 60 * 60 * 1000
};

// --- REGISTER SERVICE ---
export const register = async (req, res) => {
  const { name, email, password } = req.body; // 🔒 role removed — never trust client input for this

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user' // 🔒 always 'user' on public self-registration, no exceptions
    });

    const { accessToken, refreshToken } = generateTokens(newUser);

    res.cookie('jwt_refresh', refreshToken, refreshCookieOptions);

    res.status(201).json({
      message: 'User registered successfully',
      token: accessToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        wallet: newUser.wallet
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// --- LOGIN SERVICE ---
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie('jwt_refresh', refreshToken, refreshCookieOptions);

    res.json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallet: user.wallet
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// --- REFRESH TOKEN SERVICE ---
export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.jwt_refresh;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  try {
    const verified = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(verified.id);
    if (!user) {
      return res.status(403).json({ message: 'User account no longer exists' });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({ token: accessToken });
  } catch (err) {
    res.status(403).json({ message: 'Refresh token expired or invalid. Please log in again.' });
  }
};

// --- LOGOUT SERVICE ---
export const logout = (req, res) => {
  res.clearCookie('jwt_refresh', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
};