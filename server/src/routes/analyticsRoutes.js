import { Router } from 'express';
import { getProjectAnalytics } from '../controllers/analyticsController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.use(authenticateUser);
router.get('/project/:projectId', getProjectAnalytics);

export default router;
