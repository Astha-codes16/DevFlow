import { z } from 'zod';

export const createIssueSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  type: z.enum(['BUG', 'FEATURE', 'IMPROVEMENT', 'DOCUMENTATION', 'TASK']).default('BUG'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  labels: z.array(z.string()).optional().default([]),
  assignee: z.string().optional().nullable(),
  project: z.string().min(1, 'Project ID is required'),
});

export const updateIssueSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(5).optional(),
  type: z.enum(['BUG', 'FEATURE', 'IMPROVEMENT', 'DOCUMENTATION', 'TASK']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional().nullable(),
});

export const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});
