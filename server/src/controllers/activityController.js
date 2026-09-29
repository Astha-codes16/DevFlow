import { Activity } from '../models/Activity.js';

export const getProjectActivity = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { limit = 40 } = req.query;

    const activities = await Activity.find({ project: projectId })
      .populate('actor', 'name email avatar')
      .populate('issue', 'issueNumber title status')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    next(error);
  }
};
