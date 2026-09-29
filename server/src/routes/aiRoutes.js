import { Router } from 'express';
import {
  analyzeIssueHandler,
  generateFixPromptHandler,
  detectDuplicatesHandler,
  analyzePRHandler,
  getProjectInsightsHandler,
} from '../controllers/aiController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.use(authenticateUser);

router.post('/analyze-issue', analyzeIssueHandler);
router.post('/generate-fix-prompt', generateFixPromptHandler);
router.post('/detect-duplicates', detectDuplicatesHandler);
router.post('/analyze-pr', analyzePRHandler);
router.get('/project-insights/:projectId', getProjectInsightsHandler);

export default router;
