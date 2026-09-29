import { Router } from 'express';
import {
  createIssue,
  getIssues,
  getIssueById,
  updateIssue,
  deleteIssue,
  addComment,
} from '../controllers/issueController.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createIssueSchema,
  updateIssueSchema,
  commentSchema,
} from '../validators/issueValidator.js';
import {
  linkPullRequestToIssue,
  unlinkPullRequestFromIssue,
} from '../controllers/githubController.js';

const router = Router();

router.use(authenticateUser);

router.route('/')
  .post(validate(createIssueSchema), createIssue)
  .get(getIssues);

router.route('/:id')
  .get(getIssueById)
  .put(validate(updateIssueSchema), updateIssue)
  .delete(deleteIssue);

router.post('/:id/comments', validate(commentSchema), addComment);
router.post('/:issueId/github/link-pr', linkPullRequestToIssue);
router.delete('/:issueId/github/link-pr/:prNumber', unlinkPullRequestFromIssue);

export default router;
