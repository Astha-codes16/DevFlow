import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'DEVELOPER', 'VIEWER'],
      default: 'DEVELOPER',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    key: {
      type: String,
      required: [true, 'Project key is required'],
      uppercase: true,
      trim: true,
      maxlength: [10, 'Project key cannot exceed 10 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [memberSchema],
    github: {
      connected: { type: Boolean, default: false },
      owner: { type: String, default: '' },
      repository: { type: String, default: '' },
      repositoryId: { type: Number, default: 0 },
      url: { type: String, default: '' },
      defaultBranch: { type: String, default: 'main' },
      description: { type: String, default: '' },
      stars: { type: Number, default: 0 },
      forks: { type: Number, default: 0 },
      openIssues: { type: Number, default: 0 },
      connectedAt: { type: Date },
      connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // Backwards compatibility alias
    githubRepository: {
      connected: { type: Boolean, default: false },
      owner: { type: String, default: '' },
      repo: { type: String, default: '' },
      url: { type: String, default: '' },
      defaultBranch: { type: String, default: 'main' },
      connectedAt: { type: Date },
    },
    issueCounter: {
      type: Number,
      default: 0,
    },
    settings: {
      autoCloseOnMerge: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1 });
projectSchema.index({ 'members.user': 1 });
projectSchema.index({ 'github.owner': 1, 'github.repository': 1 });
projectSchema.index({ 'githubRepository.owner': 1, 'githubRepository.repo': 1 });

export const Project = mongoose.model('Project', projectSchema);
