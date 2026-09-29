import { Router } from 'express';
import { getProjectActivity } from '../controllers/activityController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.use(authenticateUser);
router.get('/project/:projectId', getProjectActivity);

export default router;
