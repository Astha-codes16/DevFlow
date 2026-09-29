import { analyzeIssue } from '../services/ai/issueAnalyzer.js';
import { generateFixPrompt } from '../services/ai/fixPromptGenerator.js';
import { findPotentialDuplicates } from '../services/ai/duplicateDetector.js';
import { analyzePullRequest } from '../services/ai/prAnalyzer.js';
import { generateProjectInsights } from '../services/ai/projectInsights.js';
import { Issue } from '../models/Issue.js';
import { Project } from '../models/Project.js';
import { PullRequest } from '../models/PullRequest.js';
import { Activity } from '../models/Activity.js';
import { githubClient } from '../services/github/githubClient.js';

export const analyzeIssueHandler = async (req, res, next) => {
  try {
    const { title, description, issueId, projectId } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required for AI analysis',
      });
    }

    let projectFiles = [];
    if (projectId) {
      const project = await Project.findById(projectId);
      if (project?.githubRepository?.connected) {
        projectFiles = await githubClient.getRepoFileTree(
          project.githubRepository.owner,
          project.githubRepository.repo
        );
      }
    }

    const analysis = await analyzeIssue({ title, description, projectFiles });

    // If an existing issueId was specified, persist the analysis to the issue
    if (issueId) {
      const issue = await Issue.findById(issueId);
      if (issue) {
        issue.aiAnalysis = {
          issueType: analysis.issueType,
          priority: analysis.priority,
          suggestedLabels: analysis.suggestedLabels,
          summary: analysis.summary,
          possibleRootCause: analysis.possibleRootCause,
          confidence: analysis.confidence,
          analyzedAt: new Date(),
        };

        if (analysis.relevantCode && analysis.relevantCode.length > 0) {
          issue.relevantCode = analysis.relevantCode;
        }

        await issue.save();

        await Activity.create({
          project: issue.project,
          issue: issue._id,
          actor: req.user._id,
          action: 'AI_ANALYZED',
          entityType: 'ISSUE',
          entityId: issue._id.toString(),
          metadata: { confidence: analysis.confidence },
        });
      }
    }

    res.status(200).json({
      success: true,
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

export const generateFixPromptHandler = async (req, res, next) => {
  try {
    const { issueId } = req.body;

    const issue = await Issue.findById(issueId)
      .populate('project')
      .populate('linkedPullRequests');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const project = issue.project;
    const relevantFiles = issue.relevantCode && issue.relevantCode.length > 0
      ? issue.relevantCode
      : [
          { file: 'src/middleware/authMiddleware.js', confidence: 94, reason: 'Core authentication pipeline' },
          { file: 'src/services/tokenService.js', confidence: 87, reason: 'Token verification and claims' },
        ];

    const promptText = await generateFixPrompt({
      issue,
      project,
      relevantFiles,
      linkedPRs: issue.linkedPullRequests || [],
    });

    issue.aiFixPrompt = {
      content: promptText,
      generatedAt: new Date(),
      modelUsed: process.env.AI_MODEL || 'gemini-1.5-flash',
    };
    await issue.save();

    await Activity.create({
      project: issue.project._id,
      issue: issue._id,
      actor: req.user._id,
      action: 'GENERATED_FIX_PROMPT',
      entityType: 'ISSUE',
      entityId: issue._id.toString(),
    });

    res.status(200).json({
      success: true,
      fixPrompt: promptText,
      generatedAt: issue.aiFixPrompt.generatedAt,
    });
  } catch (error) {
    next(error);
  }
};

export const detectDuplicatesHandler = async (req, res, next) => {
  try {
    const { projectId, title, description, currentIssueId } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({
        success: false,
        message: 'ProjectId and title are required for duplicate detection',
      });
    }

    const duplicates = await findPotentialDuplicates({
      projectId,
      title,
      description: description || '',
      currentIssueId: currentIssueId || null,
    });

    res.status(200).json({
      success: true,
      duplicates,
    });
  } catch (error) {
    next(error);
  }
};

export const analyzePRHandler = async (req, res, next) => {
  try {
    const { prId, issueId } = req.body;

    const pullRequest = await PullRequest.findById(prId);
    if (!pullRequest) {
      return res.status(404).json({ success: false, message: 'Pull request not found' });
    }

    const issue = await Issue.findById(issueId || pullRequest.issue);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found for PR comparison' });
    }

    let changedFiles = pullRequest.changedFiles || [];

    // If no changed files cached on the PR, attempt to fetch from GitHub
    if (changedFiles.length === 0) {
      try {
        const project = await Project.findById(pullRequest.project);
        const owner = project?.github?.owner || project?.githubRepository?.owner;
        const repo = project?.github?.repository || project?.githubRepository?.repo;
        if (owner && repo) {
          const { pullRequestService } = await import('../services/github/pullRequestService.js');
          changedFiles = await pullRequestService.getPullRequestFiles(owner, repo, pullRequest.prNumber);
          pullRequest.changedFiles = changedFiles;
          pullRequest.changedFilesCount = changedFiles.length;
          await pullRequest.save();
        }
      } catch (err) {
        console.warn('Could not fetch live changed files for AI PR review:', err.message);
      }
    }

    const analysis = await analyzePullRequest({
      issue,
      pullRequest,
      changedFiles,
    });

    pullRequest.aiAnalysis = analysis;
    await pullRequest.save();

    res.status(200).json({
      success: true,
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectInsightsHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const insights = await generateProjectInsights(projectId);

    res.status(200).json({
      success: true,
      ...insights,
    });
  } catch (error) {
    next(error);
  }
};
