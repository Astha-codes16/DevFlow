import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { PullRequest } from '../models/PullRequest.js';
import { IssuePullRequest } from '../models/IssuePullRequest.js';
import { repositoryService, normalizeRepoInput } from '../services/github/repositoryService.js';
import { pullRequestService } from '../services/github/pullRequestService.js';
import { requireProjectAccess } from '../middleware/projectAccess.js';

export const createProject = async (req, res, next) => {
  try {
    const { name, key, description } = req.body;

    const existingKey = await Project.findOne({ key: key.toUpperCase() });
    if (existingKey) {
      return res.status(400).json({
        success: false,
        message: `Project key "${key.toUpperCase()}" is already in use.`,
      });
    }

    const project = await Project.create({
      name,
      key: key.toUpperCase(),
      description,
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'ADMIN',
        },
      ],
    });

    await Activity.create({
      project: project._id,
      actor: req.user._id,
      action: 'CREATED_PROJECT',
      entityType: 'PROJECT',
      entityId: project._id.toString(),
      metadata: { projectName: project.name },
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (req, res, next) => {
  try {
    // Return projects owned by user or where user is member
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar role')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    await requireProjectAccess(req.params.id, req.user);
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar role');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    await requireProjectAccess(req.params.id, req.user, { requireAdmin: true });
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { name, description, settings } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (settings) project.settings = { ...project.settings, ...settings };

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    await requireProjectAccess(req.params.id, req.user, { requireAdmin: true });
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const issueIds = await Issue.find({ project: project._id }).distinct('_id');
    await Promise.all([
      Project.deleteOne({ _id: project._id }),
      Issue.deleteMany({ project: project._id }),
      PullRequest.deleteMany({ project: project._id }),
      IssuePullRequest.deleteMany({ project: project._id }),
      Activity.deleteMany({ project: project._id }),
      Notification.deleteMany({ project: project._id }),
      Comment.deleteMany({ issue: { $in: issueIds } }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const addMember = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    const { project } = await requireProjectAccess(req.params.id, req.user, { requireAdmin: true });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User to add not found' });
    }

    const existingMember = project.members.find((m) => m.user.toString() === userId);
    if (existingMember) {
      existingMember.role = role || 'DEVELOPER';
    } else {
      project.members.push({ user: userId, role: role || 'DEVELOPER' });
    }

    await project.save();
    const updated = await Project.findById(req.params.id).populate('members.user', 'name email avatar role');

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      members: updated.members,
    });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { project } = await requireProjectAccess(req.params.id, req.user, { requireAdmin: true });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.owner.toString() === userId) {
      return res.status(400).json({ success: false, message: 'Cannot remove project owner from members' });
    }

    project.members = project.members.filter((m) => m.user.toString() !== userId);
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      members: project.members,
    });
  } catch (error) {
    next(error);
  }
};

export const connectGithubRepo = async (req, res, next) => {
  try {
    const { owner, repo } = req.body;
    const { project } = await requireProjectAccess(req.params.id, req.user, { requireAdmin: true });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { owner: safeOwner, repo: safeRepo } = normalizeRepoInput(owner, repo);

    // Get user's GitHub access token if linked via OAuth
    const user = await User.findById(req.user._id).select('+githubAccessToken');
    const userToken = user?.githubAccessToken || null;

    // Connect via dedicated repositoryService domain abstraction
    const details = await repositoryService.connectRepository(
      project,
      { owner: safeOwner, repo: safeRepo },
      req.user._id,
      userToken
    );

    // Initial sync of pull requests in the background
    pullRequestService.syncProjectPullRequests(project, req.user._id, userToken).catch((e) =>
      console.warn('Initial PR sync failed:', e.message)
    );

    res.status(200).json({
      success: true,
      message: `Successfully connected GitHub repository ${details.owner}/${details.name}`,
      github: project.github,
      githubRepository: project.githubRepository,
      repository: details,
    });
  } catch (error) {
    next(error);
  }
};
