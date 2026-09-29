import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function IssuesListPage() {
  const { id: routeProjectId } = useParams();
  const { activeProject } = useProject();
  const projectId = routeProjectId || activeProject?._id;

  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');

  const fetchIssues = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        projectId,
        page,
        limit: 15,
      });
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (type) params.append('type', type);

      const res = await api.get(`/issues?${params.toString()}`);
      setIssues(res.data.issues || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [projectId, page, status, priority, type]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchIssues();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Issues
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Filter and manage project issues.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="p-4 rounded-xl bg-dark-surface border border-dark-border flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500"
          />
        </form>

        <div className="flex items-center space-x-2.5 flex-wrap w-full md:w-auto">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-slate-300 focus:outline-none focus:border-devflow-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-slate-300 focus:outline-none focus:border-devflow-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-slate-300 focus:outline-none focus:border-devflow-500"
          >
            <option value="">All Types</option>
            <option value="BUG">Bug</option>
            <option value="FEATURE">Feature</option>
            <option value="IMPROVEMENT">Improvement</option>
            <option value="DOCUMENTATION">Documentation</option>
            <option value="TASK">Task</option>
          </select>
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-xl bg-dark-surface border border-dark-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-card/60 text-slate-400 font-semibold border-b border-dark-border uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Title & Context</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">PRs</th>
                <th className="py-3 px-4">Triage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50 text-slate-300">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No issues found.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr
                    key={issue._id}
                    className="hover:bg-dark-hover transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-devflow-400">
                      <Link to={`/issues/${issue._id}`}>#{issue.issueNumber}</Link>
                    </td>

                    <td className="py-3.5 px-4 max-w-md">
                      <Link
                        to={`/issues/${issue._id}`}
                        className="font-semibold text-white group-hover:text-devflow-400 transition-colors block truncate"
                      >
                        {issue.title}
                      </Link>
                      {issue.labels && issue.labels.length > 0 && (
                        <div className="flex items-center space-x-1.5 mt-1">
                          {issue.labels.slice(0, 3).map((l) => (
                            <span
                              key={l}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-dark-bg text-slate-400 border border-dark-border"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          issue.type === 'BUG'
                            ? 'badge-bug'
                            : issue.type === 'FEATURE'
                            ? 'badge-feature'
                            : 'badge-improvement'
                        }`}
                      >
                        {issue.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          issue.priority === 'CRITICAL'
                            ? 'priority-critical'
                            : issue.priority === 'HIGH'
                            ? 'priority-high'
                            : 'priority-medium'
                        }`}
                      >
                        {issue.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-dark-card border border-dark-border font-medium text-slate-300">
                        {issue.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {issue.assignee ? (
                        <div className="flex items-center space-x-1.5">
                          <img
                            src={
                              issue.assignee.avatar ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${issue.assignee.name}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full border border-dark-border"
                          />
                          <span className="truncate max-w-[100px] text-slate-300">
                            {issue.assignee.name.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {issue.linkedPullRequests && issue.linkedPullRequests.length > 0 ? (
                        <div className="flex items-center space-x-1 text-purple-400 font-semibold">
                          <GitPullRequest className="w-3.5 h-3.5" />
                          <span>{issue.linkedPullRequests.length}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {issue.aiAnalysis?.summary ? (
                        <span
                          title={issue.aiAnalysis.summary}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-dark-card border border-dark-border text-devflow-400"
                        >
                          {Math.round((issue.aiAnalysis.confidence || 0.9) * 100)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-3 bg-dark-card/40 border-t border-dark-border flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {issues.length} of {total} total issues
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-dark-border hover:bg-dark-hover disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-dark-border hover:bg-dark-hover disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
