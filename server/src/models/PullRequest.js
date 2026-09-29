import mongoose from 'mongoose';

const pullRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      index: true,
    },
    prNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      default: '',
    },
    htmlUrl: {
      type: String,
      required: true,
    },
    author: {
      login: { type: String, default: 'developer' },
      avatarUrl: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['OPEN', 'MERGED', 'CLOSED', 'DRAFT'],
      default: 'OPEN',
      index: true,
    },
    headBranch: {
      type: String,
      default: '',
    },
    baseBranch: {
      type: String,
      default: 'main',
    },
    changedFilesCount: {
      type: Number,
      default: 0,
    },
    additions: {
      type: Number,
      default: 0,
    },
    deletions: {
      type: Number,
      default: 0,
    },
    commits: [
      {
        sha: String,
        message: String,
        author: String,
        date: Date,
        url: String,
      },
    ],
    changedFiles: [
      {
        filename: String,
        additions: Number,
        deletions: Number,
        status: String,
        patch: String,
      },
    ],
    aiAnalysis: {
      issueAlignment: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      confidence: { type: Number, default: 0 },
      summary: { type: String, default: '' },
      potentialConcerns: [{ type: String }],
      suggestedTests: [{ type: String }],
      analyzedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

pullRequestSchema.index({ project: 1, prNumber: 1 }, { unique: true });

export const PullRequest = mongoose.model('PullRequest', pullRequestSchema);
