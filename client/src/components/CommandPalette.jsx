import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Kanban,
  ListTodo,
  BarChart3,
  Settings,
  FolderGit2,
  ArrowRight,
  X,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function CommandPalette({ isOpen, onClose, onOpenCreateIssue }) {
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const { activeProject, projects, selectProject } = useProject();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeProject) return;

    const delayDebounce = setTimeout(async () => {
      if (query.trim().length > 1) {
        try {
          setLoading(true);
          const res = await api.get(`/issues?projectId=${activeProject._id}&search=${encodeURIComponent(query)}&limit=8`);
          setIssues(res.data.issues || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        setIssues([]);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen, activeProject]);

  if (!isOpen) return null;

  const handleAction = (callback) => {
    onClose();
    callback();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-dark-surface border border-dark-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-dark-border py-3">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search issues..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-dark-bg rounded border border-dark-border">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-2 space-y-4">
          {/* Matched Issues */}
          {issues.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Matching Issues
              </div>
              <div className="space-y-1">
                {issues.map((issue) => (
                  <button
                    key={issue._id}
                    onClick={() => handleAction(() => navigate(`/issues/${issue._id}`))}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-dark-hover flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span className="text-xs font-mono font-bold text-devflow-400">
                        #{issue.issueNumber}
                      </span>
                      <span className="text-sm text-slate-200 truncate group-hover:text-white">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-card border border-dark-border text-slate-400">
                        {issue.status}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-devflow-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Quick Actions
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleAction(onOpenCreateIssue)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-dark-hover flex items-center space-x-3 text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-devflow-600/20 text-devflow-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Create issue</span>
              </button>

              {activeProject && (
                <>
                  <button
                    onClick={() => handleAction(() => navigate(`/projects/${activeProject._id}/board`))}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-dark-hover flex items-center space-x-3 text-slate-200 hover:text-white transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Kanban className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Open board</span>
                  </button>

                  <button
                    onClick={() => handleAction(() => navigate(`/projects/${activeProject._id}/analytics`))}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-dark-hover flex items-center space-x-3 text-slate-200 hover:text-white transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Open analytics</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Switch Projects */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Switch Project
            </div>
            <div className="space-y-1">
              {projects.map((p) => (
                <button
                  key={p._id}
                  onClick={() =>
                    handleAction(() => {
                      selectProject(p);
                      navigate(`/projects/${p._id}/board`);
                    })
                  }
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-dark-hover flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-devflow-400" />
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{p.key}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-border bg-dark-bg/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with mouse or Tab</span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
}
