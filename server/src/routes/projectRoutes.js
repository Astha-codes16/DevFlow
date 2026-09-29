import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  connectGithubRepo,
} from '../controllers/projectController.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  memberSchema,
  connectGithubSchema,
} from '../validators/projectValidator.js';

const router = Router();

router.use(authenticateUser);

router.route('/')
  .post(validate(createProjectSchema), createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById)
  .put(validate(updateProjectSchema), updateProject)
  .delete(deleteProject);

router.post('/:id/members', validate(memberSchema), addMember);
router.delete('/:id/members/:userId', removeMember);
router.post('/:id/github', validate(connectGithubSchema), connectGithubRepo);

export default router;
