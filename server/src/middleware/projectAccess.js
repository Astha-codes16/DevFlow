import mongoose from 'mongoose';
import { Project } from '../models/Project.js';

const authorizationError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const requireProjectAccess = async (projectId, user, { requireAdmin = false } = {}) => {
  if (!mongoose.isValidObjectId(projectId)) {
    throw authorizationError('Project not found', 404);
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw authorizationError('Project not found', 404);
  }

  const userId = user._id.toString();
  const isSystemAdmin = user.role === 'ADMIN';
  const isOwner = project.owner.toString() === userId;
  const membership = project.members.find((member) => member.user.toString() === userId);
  const isProjectAdmin = isOwner || membership?.role === 'ADMIN';

  if (requireAdmin && !isSystemAdmin && !isProjectAdmin) {
    throw authorizationError('Project administrator permissions required', 403);
  }

  if (!isSystemAdmin && !isOwner && !membership) {
    throw authorizationError('Project not found', 404);
  }

  return {
    project,
    isSystemAdmin,
    isOwner,
    membership,
    isProjectAdmin: isSystemAdmin || isProjectAdmin,
  };
};

export const assertSameProject = (firstProjectId, secondProjectId) => {
  if (firstProjectId.toString() !== secondProjectId.toString()) {
    throw authorizationError('Referenced resources do not belong to the same project', 404);
  }
};

export const assertProjectMember = (project, userId) => {
  if (!userId) return;

  const targetId = userId.toString();
  const isOwner = project.owner.toString() === targetId;
  const isMember = project.members.some((member) => member.user.toString() === targetId);

  if (!isOwner && !isMember) {
    throw authorizationError('Assignee must be a member of this project', 400);
  }
};
