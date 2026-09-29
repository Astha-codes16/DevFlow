import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Kanban,
  Search,
  Filter,
  Plus,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ArrowRight,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

const COLUMNS = [
  { id: 'OPEN', label: 'Open', color: 'border-slate-600/40 text-slate-300' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500/40 text-blue-400' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'border-purple-500/40 text-purple-400' },
  { id: 'RESOLVED', label: 'Resolved', color: 'border-emerald-500/40 text-emerald-400' },
  { id: 'CLOSED', label: 'Closed', color: 'border-slate-700/50 text-slate-500' },
];

export default function KanbanBoardPage() {
  const { id: routeProjectId } = useParams();
  const { activeProject } = useProject();
  const projectId = routeProjectId || activeProject?._id;

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [draggedIssueId, setDraggedIssueId] = useState(null);

  const fetchIssues = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await api.get(`/issues?projectId=${projectId}&limit=100`);
      setIssues(res.data.issues || []);
    } catch (err) {
      console.error('Failed to load board issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [projectId]);

  // Handle Drag & Drop
  const handleDragStart = (e, issueId) => {
    setDraggedIssueId(issueId);
    e.dataTransfer.setData('text/plain', issueId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (!issueId) return;

    const issue = issues.find((i) => i._id === issueId);
    if (!issue || issue.status === targetStatus) return;

    // Optimistic UI update
    setIssues((prev) =>
      prev.map((i) => (i._id === issueId ? { ...i, status: targetStatus } : i))
    );

    try {
      await api.put(`/issues/${issueId}`, { status: targetStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchIssues(); // Revert on failure
    } finally {
      setDraggedIssueId(null);
    }
  };

  // Quick move buttons for touch / accessibility
  const moveIssue = async (issueId, newStatus) => {
    setIssues((prev) =>
      prev.map((i) => (i._id === issueId ? { ...i, status: newStatus } : i))
    );
    try {
      await api.put(`/issues/${issueId}`, { status: newStatus });
    } catch (err) {
      fetchIssues();
    }
  };

  // Filtered issues
  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      !search ||
      issue.title.toLowerCase().includes(search.toLowerCase()) ||
      String(issue.issueNumber).includes(search);
    const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
    const matchesType = !typeFilter || issue.type === typeFilter;
    return matchesSearch && matchesPriority && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Board Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Board
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-dark-card border border-dark-border text-slate-400 font-mono">
              {filteredIssues.length} issues
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track and update issue status across workflow stages.
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title or #..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-dark-surface border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 w-44"
            />
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-dark-surface border border-dark-border text-xs text-slate-300 focus:outline-none focus:border-devflow-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-dark-surface border border-dark-border text-xs text-slate-300 focus:outline-none focus:border-devflow-500"
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

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
        {COLUMNS.map((column, colIdx) => {
          const colIssues = filteredIssues.filter((i) => i.status === column.id);

          return (
            <div
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className="rounded-2xl bg-dark-surface/60 border border-dark-border/80 p-3 flex flex-col min-h-[480px] transition-colors"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-dark-border/60">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${column.color.split(' ')[1].replace('text-', 'bg-')}`}></span>
                  <span className="font-semibold text-xs text-slate-200">{column.label}</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-dark-card border border-dark-border text-slate-400">
                  {colIssues.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1">
                {colIssues.length === 0 ? (
                  <div className="h-28 border border-dashed border-dark-border/40 rounded-xl flex items-center justify-center text-[11px] text-slate-600">
                    No issues
                  </div>
                ) : (
                  colIssues.map((issue) => (
                    <div
                      key={issue._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, issue._id)}
                      className="p-3.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border/80 shadow-sm transition-all cursor-grab active:cursor-grabbing group hover:border-devflow-500/40 relative"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-xs font-bold text-devflow-400">
                            #{issue.issueNumber}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              issue.priority === 'CRITICAL'
                                ? 'priority-critical'
                                : issue.priority === 'HIGH'
                                ? 'priority-high'
                                : 'priority-medium'
                            }`}
                          >
                            {issue.priority}
                          </span>
                        </div>

                        {issue.linkedPullRequests?.length > 0 && (
                          <div className="flex items-center text-purple-400 text-[10px]" title="Linked PR">
                            <GitPullRequest className="w-3 h-3 mr-0.5" />
                            <span>{issue.linkedPullRequests.length}</span>
                          </div>
                        )}
                      </div>

                      <Link
                        to={`/issues/${issue._id}`}
                        className="block font-medium text-xs text-slate-100 hover:text-white line-clamp-2 mb-2 group-hover:text-devflow-300 transition-colors"
                      >
                        {issue.title}
                      </Link>

                      {/* Labels */}
                      {issue.labels && issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {issue.labels.slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-dark-bg/80 text-slate-400 border border-dark-border/60"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Assignee & Step Movement */}
                      <div className="flex items-center justify-between pt-2 border-t border-dark-border/50 text-[11px] text-slate-400">
                        <div className="flex items-center space-x-1.5 truncate max-w-[120px]">
                          {issue.assignee ? (
                            <>
                              <img
                                src={
                                  issue.assignee.avatar ||
                                  `https://api.dicebear.com/7.x/initials/svg?seed=${issue.assignee.name}`
                                }
                                alt={issue.assignee.name}
                                className="w-4 h-4 rounded-full border border-dark-border"
                              />
                              <span className="truncate text-[10px] text-slate-300">
                                {issue.assignee.name.split(' ')[0]}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500">Unassigned</span>
                          )}
                        </div>

                        {/* Quick column shift arrows */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {colIdx > 0 && (
                            <button
                              onClick={() => moveIssue(issue._id, COLUMNS[colIdx - 1].id)}
                              title={`Move back to ${COLUMNS[colIdx - 1].label}`}
                              className="p-1 hover:text-white rounded hover:bg-dark-surface"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <button
                              onClick={() => moveIssue(issue._id, COLUMNS[colIdx + 1].id)}
                              title={`Move next to ${COLUMNS[colIdx + 1].label}`}
                              className="p-1 hover:text-white rounded hover:bg-dark-surface"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
