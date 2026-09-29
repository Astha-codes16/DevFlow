import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Kanban,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeProject } = useProject();

  const [stats, setStats] = useState(null);
  const [recentIssues, setRecentIssues] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pullRequests, setPullRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [statsRes, issuesRes, actRes, pullsRes] = await Promise.all([
          api.get(`/analytics/project/${activeProject._id}`),
          api.get(`/issues?projectId=${activeProject._id}&limit=6`),
          api.get(`/activity/project/${activeProject._id}?limit=8`),
          api.get(`/github/repos/${activeProject._id}/pulls`),
        ]);

        setStats(statsRes.data.stats);
        setRecentIssues(issuesRes.data.issues || []);
        setActivities(actRes.data.activities || []);
        setPullRequests(pullsRes.data.pullRequests || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [activeProject]);

  if (!activeProject) {
    return (
      <div className="text-center py-20">
        <FolderGit2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-1">No Active Project</h2>
        <p className="text-slate-400 text-xs mb-5">Select or create a project to view the dashboard.</p>
        <Link
          to="/projects"
          className="px-4 py-2 rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white font-medium text-xs transition-colors"
        >
          View Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Overview */}
      <div className="rounded-2xl p-6 bg-dark-surface border border-dark-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-devflow-400 bg-devflow-500/10 px-2 py-0.5 rounded border border-devflow-500/20 font-semibold">
                {activeProject.key}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {activeProject.githubRepository?.connected
                  ? `${activeProject.githubRepository.owner}/${activeProject.githubRepository.repo}`
                  : 'No repository connected'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {activeProject.name}
            </h1>
            <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
              {activeProject.description || 'Project overview and recent activity.'}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to={`/projects/${activeProject._id}/board`}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white text-xs font-semibold transition-colors"
            >
              <Kanban className="w-4 h-4" />
              <span>Board</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Issues</span>
            <AlertCircle className="w-4 h-4 text-devflow-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats?.total || 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total project issues</div>
        </div>

        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>In Progress & Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {(stats?.inProgress || 0) + (stats?.inReview || 0)}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">{stats?.inReview || 0} in review</div>
        </div>

        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats?.resolved || 0}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Closed issues</div>
        </div>

        <div className="p-4 rounded-xl bg-dark-surface border border-dark-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Pull Requests</span>
            <GitPullRequest className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{pullRequests.length}</div>
          <div className="text-[11px] text-purple-400/80 mt-1">Synced from GitHub</div>
        </div>
      </div>

      {/* Main Content Grid: Recent Issues & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Issues (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Active Issues</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-dark-card border border-dark-border text-slate-400">
                {recentIssues.length}
              </span>
            </h2>
            <Link
              to={`/projects/${activeProject._id}/issues`}
              className="text-xs text-devflow-400 hover:text-devflow-300 font-medium flex items-center space-x-1"
            >
              <span>View all issues</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentIssues.map((issue) => (
              <Link
                key={issue._id}
                to={`/issues/${issue._id}`}
                className="block p-4 rounded-2xl bg-dark-surface hover:bg-dark-hover border border-dark-border transition-all duration-150 group shadow-sm hover:border-devflow-500/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-devflow-400">
                        #{issue.issueNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        issue.type === 'BUG' ? 'badge-bug' : issue.type === 'FEATURE' ? 'badge-feature' : 'badge-improvement'
                      }`}>
                        {issue.type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        issue.priority === 'CRITICAL' ? 'priority-critical' : issue.priority === 'HIGH' ? 'priority-high' : 'priority-medium'
                      }`}>
                        {issue.priority}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-slate-100 group-hover:text-white truncate">
                      {issue.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {issue.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-dark-card border border-dark-border text-slate-300 font-medium">
                      {issue.status}
                    </span>
                    {issue.assignee && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                        {issue.assignee.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Activity Stream (1 column) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Project Activity</span>
            </h2>
            <span className="text-[11px] text-slate-500">Live timeline</span>
          </div>

          <div className="rounded-2xl bg-dark-surface border border-dark-border p-4 shadow-sm space-y-3.5">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No recorded activity yet.
              </div>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="flex items-start space-x-3 text-xs">
                  <img
                    src={act.actor?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${act.actor?.name || 'User'}`}
                    alt={act.actor?.name}
                    className="w-6 h-6 rounded-full border border-dark-border mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200">
                      <span className="font-semibold text-white">{act.actor?.name || 'Developer'}</span>{' '}
                      <span className="text-slate-400">
                        {act.action === 'CREATED_ISSUE' && 'reported issue'}
                        {act.action === 'UPDATED_STATUS' && `moved issue to ${act.metadata?.to}`}
                        {act.action === 'AI_ANALYZED' && 'analyzed'}
                        {act.action === 'GENERATED_FIX_PROMPT' && 'generated fix prompt for'}
                        {act.action === 'LINKED_PR' && `linked PR #${act.metadata?.prNumber} to`}
                        {act.action === 'MERGED_PR' && `merged PR #${act.metadata?.prNumber} for`}
                        {act.action === 'ADDED_COMMENT' && 'commented on'}
                      </span>{' '}
                      {act.issue && (
                        <Link
                          to={`/issues/${act.issue._id || act.issue}`}
                          className="font-mono text-devflow-400 hover:underline"
                        >
                          #{act.issue.issueNumber || ''}
                        </Link>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
