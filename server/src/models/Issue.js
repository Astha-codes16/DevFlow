import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    issueNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
    },
    type: {
      type: String,
      enum: ['BUG', 'FEATURE', 'IMPROVEMENT', 'DOCUMENTATION', 'TASK'],
      default: 'BUG',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    labels: [
      {
        type: String,
        trim: true,
      },
    ],
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    linkedPullRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PullRequest',
      },
    ],
    aiAnalysis: {
      issueType: { type: String },
      priority: { type: String },
      suggestedLabels: [{ type: String }],
      summary: { type: String },
      possibleRootCause: { type: String },
      confidence: { type: Number },
      analyzedAt: { type: Date },
    },
    relevantCode: [
      {
        file: { type: String, required: true },
        confidence: { type: Number, required: true },
        reason: { type: String },
      },
    ],
    aiFixPrompt: {
      content: { type: String },
      generatedAt: { type: Date },
      modelUsed: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee uniqueness of issue number within a project
issueSchema.index({ project: 1, issueNumber: 1 }, { unique: true });
issueSchema.index({ project: 1, status: 1 });
issueSchema.index({ project: 1, priority: 1 });
issueSchema.index({ project: 1, assignee: 1 });
issueSchema.index({ createdAt: -1 });

export const Issue = mongoose.model('Issue', issueSchema);
