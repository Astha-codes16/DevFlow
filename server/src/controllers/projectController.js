import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Activity } from '../models/Activity.js';
import { repositoryService, normalizeRepoInput } from '../services/github/repositoryService.js';
import { pullRequestService } from '../services/github/pullRequestService.js';

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
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check admin permissions
    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find((m) => m.user.toString() === req.user._id.toString());
    const isAdmin = isOwner || member?.role === 'ADMIN';

    if (!isAdmin && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin permissions required to modify project' });
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
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only project owner or system admin can delete this project' });
    }

    await Project.findByIdAndDelete(req.params.id);

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
    const project = await Project.findById(req.params.id);

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
    const project = await Project.findById(req.params.id);

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
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!isOwner && member?.role !== 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Project administrator role is required.',
      });
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
