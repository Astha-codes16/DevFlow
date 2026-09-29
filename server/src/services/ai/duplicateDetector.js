import { Issue } from '../../models/Issue.js';

/**
 * Duplicate Detector compares a candidate issue against existing issues in the project.
 * Uses N-gram token overlap, Jaccard similarity, and label/type affinity.
 */
export const findPotentialDuplicates = async ({ projectId, title, description, currentIssueId = null }) => {
  const query = { project: projectId };
  if (currentIssueId) {
    query._id = { $ne: currentIssueId };
  }

  const existingIssues = await Issue.find(query).select('issueNumber title description type status labels priority createdAt').lean();

  if (!existingIssues || existingIssues.length === 0) {
    return [];
  }

  const candidateTokens = tokenize(`${title} ${description}`);

  const scoredMatches = existingIssues.map((issue) => {
    const existingTokens = tokenize(`${issue.title} ${issue.description}`);
    const similarity = calculateJaccardSimilarity(candidateTokens, existingTokens);

    // Title specific similarity boost
    const titleTokens1 = tokenize(title);
    const titleTokens2 = tokenize(issue.title);
    const titleSim = calculateJaccardSimilarity(titleTokens1, titleTokens2);

    // Label overlap bonus
    let labelBonus = 0;
    if (issue.labels && issue.labels.length > 0) {
      const titleLower = title.toLowerCase();
      issue.labels.forEach((l) => {
        if (titleLower.includes(l.toLowerCase())) labelBonus += 0.05;
      });
    }

    // Weighted combined score
    const combinedScore = Math.min(
      Math.round((similarity * 0.4 + titleSim * 0.5 + labelBonus * 0.1) * 100),
      99
    );

    return {
      issueId: issue._id,
      issueNumber: issue.issueNumber,
      title: issue.title,
      status: issue.status,
      type: issue.type,
      priority: issue.priority,
      similarityScore: combinedScore,
    };
  });

  // Return matches with similarity above threshold (e.g. >= 40%) sorted descending
  return scoredMatches
    .filter((m) => m.similarityScore >= 35)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5);
};

function tokenize(text) {
  if (!text) return new Set();
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'when',
    'this', 'that', 'it', 'from', 'as', 'are', 'was', 'by', 'be', 'or', 'not', 'have', 'has'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

function calculateJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}
