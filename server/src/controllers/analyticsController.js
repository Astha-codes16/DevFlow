import { Issue } from '../models/Issue.js';
import { Project } from '../models/Project.js';
import { generateProjectInsights } from '../services/ai/projectInsights.js';

export const getProjectAnalytics = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const issues = await Issue.find({ project: projectId })
      .populate('assignee', 'name avatar')
      .lean();

    const totalIssues = issues.length;

    // Status breakdown
    const statusCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    // Priority breakdown
    const priorityCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    // Type breakdown
    const typeCounts = {
      BUG: 0,
      FEATURE: 0,
      IMPROVEMENT: 0,
      DOCUMENTATION: 0,
      TASK: 0,
    };

    // Developer workload map
    const devWorkload = {};

    issues.forEach((issue) => {
      if (statusCounts[issue.status] !== undefined) statusCounts[issue.status]++;
      if (priorityCounts[issue.priority] !== undefined) priorityCounts[issue.priority]++;
      if (typeCounts[issue.type] !== undefined) typeCounts[issue.type]++;

      const assigneeName = issue.assignee?.name || 'Unassigned';
      if (!devWorkload[assigneeName]) {
        devWorkload[assigneeName] = { name: assigneeName, total: 0, resolved: 0, active: 0 };
      }
      devWorkload[assigneeName].total++;
      if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
        devWorkload[assigneeName].resolved++;
      } else {
        devWorkload[assigneeName].active++;
      }
    });

    const issuesByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    const issuesByPriority = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
    }));

    const issuesByType = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
    }));

    const issuesByDeveloper = Object.values(devWorkload);

    // AI Project Insights
    const aiInsights = await generateProjectInsights(projectId);

    res.status(200).json({
      success: true,
      stats: {
        total: totalIssues,
        open: statusCounts.OPEN,
        inProgress: statusCounts.IN_PROGRESS,
        inReview: statusCounts.IN_REVIEW,
        resolved: statusCounts.RESOLVED,
        closed: statusCounts.CLOSED,
      },
      charts: {
        byStatus: issuesByStatus,
        byPriority: issuesByPriority,
        byType: issuesByType,
        byDeveloper: issuesByDeveloper,
      },
      aiInsights,
    });
  } catch (error) {
    next(error);
  }
};
