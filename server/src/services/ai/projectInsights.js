import { Issue } from '../../models/Issue.js';

export const generateProjectInsights = async (projectId) => {
  const issues = await Issue.find({ project: projectId }).lean();

  if (!issues || issues.length === 0) {
    return {
      insights: [
        {
          type: 'INFO',
          icon: 'sparkles',
          message: 'Project is fresh. Create your first issues to enable AI velocity and bottleneck analysis.',
        },
      ],
      healthScore: 100,
    };
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Inactive / Stale issues
  const staleIssues = issues.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED' && new Date(i.updatedAt) < fourteenDaysAgo
  );

  // Unresolved bugs count and label breakdown
  const unresolvedBugs = issues.filter((i) => i.type === 'BUG' && i.status !== 'RESOLVED' && i.status !== 'CLOSED');
  const labelCounts = {};
  unresolvedBugs.forEach((b) => {
    (b.labels || []).forEach((l) => {
      labelCounts[l] = (labelCounts[l] || 0) + 1;
    });
  });

  const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
  const topHotspot = sortedLabels[0];

  // Critical open issues
  const criticalOpen = issues.filter(
    (i) => i.priority === 'CRITICAL' && (i.status === 'OPEN' || i.status === 'IN_PROGRESS')
  );

  const insights = [];

  if (criticalOpen.length > 0) {
    insights.push({
      type: 'CRITICAL',
      icon: 'alert-triangle',
      message: `🚨 ${criticalOpen.length} CRITICAL ${criticalOpen.length === 1 ? 'issue requires' : 'issues require'} immediate triage to unblock releases.`,
      issues: criticalOpen.map((c) => ({ id: c._id, number: c.issueNumber, title: c.title })),
    });
  }

  if (staleIssues.length > 0) {
    insights.push({
      type: 'WARNING',
      icon: 'clock',
      message: `⚠️ ${staleIssues.length} ${staleIssues.length === 1 ? 'issue has' : 'issues have'} been inactive for more than 14 days without status updates.`,
    });
  }

  if (topHotspot && topHotspot[1] >= 2) {
    insights.push({
      type: 'HOTSPOT',
      icon: 'zap',
      message: `🔥 "${topHotspot[0]}" domain currently represents the highest concentration of unresolved bugs (${topHotspot[1]} active). Recommended: prioritize test coverage here.`,
    });
  }

  const resolvedCount = issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
  const resolutionRate = Math.round((resolvedCount / issues.length) * 100);

  insights.push({
    type: 'VELOCITY',
    icon: 'trending-up',
    message: `💡 Project resolution rate is ${resolutionRate}%. ${resolvedCount} of ${issues.length} total issues resolved.`,
  });

  return {
    insights,
    healthScore: Math.max(30, Math.min(100, 100 - criticalOpen.length * 15 - staleIssues.length * 5)),
  };
};
