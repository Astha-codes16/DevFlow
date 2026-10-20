import { Router } from 'express';
import {
  register,
  login,
  getMe,
  getAllUsers,
  updateUserRole,
  initiateGitHubOAuth,
  handleGitHubOAuthCallback,
} from '../controllers/authController.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, roleUpdateSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticateUser, getMe);
router.get('/users', authenticateUser, getAllUsers);
router.patch('/users/:id/role', authenticateUser, requireRole('ADMIN'), validate(roleUpdateSchema), updateUserRole);

// GitHub OAuth
router.get('/github', authenticateUser, initiateGitHubOAuth);
router.get('/github/callback', handleGitHubOAuthCallback);

export default router;
