import { Issue } from '../models/Issue.js';
import { Project } from '../models/Project.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

export const createIssue = async (req, res, next) => {
  try {
    const { title, description, type, priority, labels, assignee, project: projectId } = req.body;

    // Atomically increment project issueCounter
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $inc: { issueCounter: 1 } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const issueNumber = project.issueCounter;

    const issue = await Issue.create({
      issueNumber,
      title,
      description,
      type: type || 'BUG',
      priority: priority || 'MEDIUM',
      labels: labels || [],
      reporter: req.user._id,
      assignee: assignee || null,
      project: projectId,
    });

    // Create activity
    await Activity.create({
      project: projectId,
      issue: issue._id,
      actor: req.user._id,
      action: 'CREATED_ISSUE',
      entityType: 'ISSUE',
      entityId: issue._id.toString(),
      metadata: { issueNumber, title: issue.title },
    });

    // Notify assignee if assigned
    if (assignee && assignee !== req.user._id.toString()) {
      await Notification.create({
        recipient: assignee,
        sender: req.user._id,
        project: projectId,
        issue: issue._id,
        title: `Assigned to Issue #${issueNumber}`,
        message: `${req.user.name} assigned you to "${issue.title}"`,
        type: 'ASSIGNED',
      });
    }

    const populated = await Issue.findById(issue._id)
      .populate('reporter', 'name email avatar')
      .populate('assignee', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      issue: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const getIssues = async (req, res, next) => {
  try {
    const {
      projectId,
      status,
      priority,
      type,
      assignee,
      label,
      search,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const filter = {};

    if (projectId) filter.project = projectId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    if (assignee) filter.assignee = assignee;
    if (label) filter.labels = label;

    if (search) {
      const searchNum = parseInt(search, 10);
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
      if (!isNaN(searchNum)) {
        filter.$or.push({ issueNumber: searchNum });
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate('reporter', 'name email avatar')
        .populate('assignee', 'name email avatar')
        .populate('linkedPullRequests', 'prNumber title status htmlUrl author')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Issue.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      issues,
    });
  } catch (error) {
    next(error);
  }
};

export const getIssueById = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reporter', 'name email avatar')
      .populate('assignee', 'name email avatar')
      .populate('project', 'name key github githubRepository members')
      .populate('linkedPullRequests');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const comments = await Comment.find({ issue: issue._id })
      .populate('author', 'name email avatar')
      .sort({ createdAt: 1 });

    const activities = await Activity.find({ issue: issue._id })
      .populate('actor', 'name email avatar')
      .sort({ timestamp: -1 })
      .limit(30);

    res.status(200).json({
      success: true,
      issue,
      comments,
      activities,
    });
  } catch (error) {
    next(error);
  }
};

export const updateIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const { title, description, type, status, priority, labels, assignee } = req.body;
    const activitiesToCreate = [];

    // Track status change
    if (status && status !== issue.status) {
      activitiesToCreate.push({
        project: issue.project,
        issue: issue._id,
        actor: req.user._id,
        action: 'UPDATED_STATUS',
        entityType: 'ISSUE',
        entityId: issue._id.toString(),
        metadata: { from: issue.status, to: status },
      });

      // Notification
      const notifyTarget = issue.assignee || issue.reporter;
      if (notifyTarget && notifyTarget.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: notifyTarget,
          sender: req.user._id,
          project: issue.project,
          issue: issue._id,
          title: `Status Changed: #${issue.issueNumber}`,
          message: `${req.user.name} moved #${issue.issueNumber} from ${issue.status} to ${status}`,
          type: 'STATUS_CHANGE',
        });
      }

      issue.status = status;
    }

    // Track priority change
    if (priority && priority !== issue.priority) {
      activitiesToCreate.push({
        project: issue.project,
        issue: issue._id,
        actor: req.user._id,
        action: 'UPDATED_PRIORITY',
        entityType: 'ISSUE',
        entityId: issue._id.toString(),
        metadata: { from: issue.priority, to: priority },
      });
      issue.priority = priority;
    }

    // Track assignee change
    if (assignee !== undefined && String(assignee) !== String(issue.assignee)) {
      activitiesToCreate.push({
        project: issue.project,
        issue: issue._id,
        actor: req.user._id,
        action: 'ASSIGNED_USER',
        entityType: 'ISSUE',
        entityId: issue._id.toString(),
        metadata: { assignee },
      });

      if (assignee && assignee !== req.user._id.toString()) {
        await Notification.create({
          recipient: assignee,
          sender: req.user._id,
          project: issue.project,
          issue: issue._id,
          title: `Assigned to Issue #${issue.issueNumber}`,
          message: `${req.user.name} assigned you to #${issue.issueNumber} "${issue.title}"`,
          type: 'ASSIGNED',
        });
      }

      issue.assignee = assignee;
    }

    if (title) issue.title = title;
    if (description) issue.description = description;
    if (type) issue.type = type;
    if (labels) issue.labels = labels;

    await issue.save();

    if (activitiesToCreate.length > 0) {
      await Activity.insertMany(activitiesToCreate);
    }

    const updated = await Issue.findById(issue._id)
      .populate('reporter', 'name email avatar')
      .populate('assignee', 'name email avatar')
      .populate('linkedPullRequests');

    res.status(200).json({
      success: true,
      message: 'Issue updated successfully',
      issue: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteIssue = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    await Promise.all([
      Issue.findByIdAndDelete(req.params.id),
      Comment.deleteMany({ issue: req.params.id }),
      Activity.deleteMany({ issue: req.params.id }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Issue deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const comment = await Comment.create({
      issue: issue._id,
      author: req.user._id,
      content,
    });

    await Activity.create({
      project: issue.project,
      issue: issue._id,
      actor: req.user._id,
      action: 'ADDED_COMMENT',
      entityType: 'COMMENT',
      entityId: comment._id.toString(),
      metadata: { commentSnippet: content.substring(0, 60) },
    });

    // Notify issue assignee / reporter
    const notifyId = issue.assignee?.toString() === req.user._id.toString() ? issue.reporter : issue.assignee;
    if (notifyId && notifyId.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: notifyId,
        sender: req.user._id,
        project: issue.project,
        issue: issue._id,
        title: `New Comment on #${issue.issueNumber}`,
        message: `${req.user.name} commented on "${issue.title}"`,
        type: 'COMMENT',
      });
    }

    const populated = await Comment.findById(comment._id).populate('author', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: populated,
    });
  } catch (error) {
    next(error);
  }
};
