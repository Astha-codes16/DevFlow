import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'devflow_super_secret_jwt_key_2026_production_grade',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, githubUsername } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'DEVELOPER',
      githubUsername: githubUsername || '',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        githubUsername: user.githubUsername,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        githubUsername: user.githubUsername,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        githubUsername: user.githubUsername,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('name email role avatar githubUsername').sort({ name: 1 });
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const initiateGitHubOAuth = async (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback';

  if (!clientId) {
    return res.status(200).json({
      configured: false,
      message: 'GitHub OAuth application is not configured in environment variables. You can still connect public repositories directly or configure GITHUB_TOKEN.',
    });
  }

  const state = req.user ? req.user._id.toString() : '';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:user&state=${state}`;

  res.status(200).json({
    configured: true,
    url,
  });
};

export const handleGitHubOAuthCallback = async (req, res, next) => {
  try {
    const { code, state: userId } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (!code || !clientId || !clientSecret) {
      return res.redirect(`${clientUrl}/projects?github_error=missing_credentials`);
    }

    // Exchange code for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.redirect(`${clientUrl}/projects?github_error=auth_failed`);
    }

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'DevFlow-AI',
      },
    });

    const ghUser = await userRes.json();

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        githubAccessToken: accessToken,
        githubUsername: ghUser.login || '',
        githubId: String(ghUser.id || ''),
      });
    }

    res.redirect(`${clientUrl}/projects?github_connected=true&username=${ghUser.login}`);
  } catch (error) {
    console.error('GitHub OAuth Callback Error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/projects?github_error=${encodeURIComponent(error.message)}`);
  }
};
