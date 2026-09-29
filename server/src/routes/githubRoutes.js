import { Router } from 'express';
import {
  getConnectedRepository,
  connectRepository,
  disconnectRepository,
  getProjectPullRequests,
  getRepositoryBranches,
  getRepositoryCommits,
  getPullRequestFiles,
  getPullRequestCommits,
  linkPullRequestToIssue,
  unlinkPullRequestFromIssue,
  handleGitHubWebhook,
} from '../controllers/githubController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

// Public GitHub Webhook endpoint (Signature verified inside controller)
router.post('/webhook', handleGitHubWebhook);

// Protected Project-level GitHub endpoints
router.get('/projects/:projectId/github', authenticateUser, getConnectedRepository);
router.post('/projects/:projectId/github/connect', authenticateUser, connectRepository);
router.delete('/projects/:projectId/github/disconnect', authenticateUser, disconnectRepository);

router.get('/projects/:projectId/github/pulls', authenticateUser, getProjectPullRequests);
router.get('/projects/:projectId/github/branches', authenticateUser, getRepositoryBranches);
router.get('/projects/:projectId/github/commits', authenticateUser, getRepositoryCommits);
router.get('/projects/:projectId/github/pulls/:prNumber/files', authenticateUser, getPullRequestFiles);
router.get('/projects/:projectId/github/pulls/:prNumber/commits', authenticateUser, getPullRequestCommits);

// Issue-level PR linking endpoints
router.post('/issues/:issueId/github/link-pr', authenticateUser, linkPullRequestToIssue);
router.delete('/issues/:issueId/github/link-pr/:prNumber', authenticateUser, unlinkPullRequestFromIssue);

// Compatibility aliases
router.get('/repos/:projectId/pulls', authenticateUser, getProjectPullRequests);
router.post('/link-pr', authenticateUser, (req, res, next) => {
  req.params.issueId = req.body.issueId;
  linkPullRequestToIssue(req, res, next);
});

export default router;
