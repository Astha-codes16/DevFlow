import mongoose from 'mongoose';

const issuePullRequestSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    pullRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PullRequest',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

issuePullRequestSchema.index({ project: 1, issue: 1, pullRequest: 1 }, { unique: true });

export const IssuePullRequest = mongoose.model('IssuePullRequest', issuePullRequestSchema);
