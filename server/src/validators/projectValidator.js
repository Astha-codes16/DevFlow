import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(100),
  key: z.string().min(2, 'Project key must be 2-10 characters').max(10).toUpperCase(),
  description: z.string().optional().default(''),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  settings: z.object({
    autoCloseOnMerge: z.boolean().optional(),
  }).optional(),
});

export const memberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['ADMIN', 'DEVELOPER', 'VIEWER']),
});

export const connectGithubSchema = z.object({
  owner: z.string().min(1, 'GitHub owner / organization is required'),
  repo: z.string().min(1, 'GitHub repository name is required'),
  url: z.string().url('Must be a valid GitHub URL').optional(),
  defaultBranch: z.string().optional().default('main'),
});
