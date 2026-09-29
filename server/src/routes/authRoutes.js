import { Router } from 'express';
import {
  register,
  login,
  getMe,
  getAllUsers,
  initiateGitHubOAuth,
  handleGitHubOAuthCallback,
} from '../controllers/authController.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticateUser, getMe);
router.get('/users', authenticateUser, getAllUsers);

// GitHub OAuth
router.get('/github', authenticateUser, initiateGitHubOAuth);
router.get('/github/callback', handleGitHubOAuthCallback);

export default router;
