import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Cpu,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Tag,
  User as UserIcon,
  Check,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function CreateIssueModal({ isOpen, onClose, onCreated }) {
  const { activeProject } = useProject();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('BUG');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [labels, setLabels] = useState('');
  const [members, setMembers] = useState([]);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch project members for assignee dropdown
  useEffect(() => {
    if (activeProject?.members) {
      setMembers(activeProject.members.map((m) => m.user));
    }
  }, [activeProject]);

  // Duplicate detection debounce
  useEffect(() => {
    if (!activeProject || title.trim().length < 6) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/ai/detect-duplicates', {
          projectId: activeProject._id,
          title,
          description,
        });
        setDuplicates(res.data.duplicates || []);
      } catch (err) {
        console.warn('Duplicate detection failed:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, description, activeProject]);

  if (!isOpen) return null;

  const handleAIAnalyze = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Provide a title and description to run analysis.');
      return;
    }
    setError('');
    setAnalyzing(true);
    try {
      const res = await api.post('/ai/analyze-issue', {
        projectId: activeProject?._id,
        title,
        description,
      });
      const data = res.data.analysis;
      setAnalysisResult(data);

      if (data.issueType) setType(data.issueType);
      if (data.priority) setPriority(data.priority);
      if (data.suggestedLabels && data.suggestedLabels.length > 0) {
        setLabels(data.suggestedLabels.join(', '));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'AI analysis temporarily unavailable');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProject) {
      setError('Please select or create an active project first.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const labelArray = labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await api.post('/issues', {
        title,
        description,
        type,
        priority,
        labels: labelArray,
        assignee: assignee || null,
        project: activeProject._id,
      });

      const newIssue = res.data.issue;

      // If user ran AI analysis, also persist it to the issue
      if (analysisResult) {
        await api.post('/ai/analyze-issue', {
          issueId: newIssue._id,
          title,
          description,
        });
      }

      onClose();
      if (onCreated) {
        onCreated(newIssue);
      } else {
        navigate(`/issues/${newIssue._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-dark-surface border border-dark-border shadow-2xl p-6 relative my-8 animate-in fade-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 mb-1">
          <span className="font-bold text-lg text-white">Create Issue</span>
          <span className="text-xs font-mono text-devflow-400 bg-devflow-500/10 px-2 py-0.5 rounded border border-devflow-500/20">
            {activeProject?.name}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Track a bug, feature request, or task for this project.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {duplicates.length > 0 && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200">
            <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300 mb-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Potential duplicate issues detected ({duplicates[0].similarityScore}% match)</span>
            </div>
            <div className="space-y-1">
              {duplicates.slice(0, 2).map((dup) => (
                <div key={dup.issueId} className="flex items-center justify-between text-xs bg-dark-bg/60 p-2 rounded-lg">
                  <div className="truncate mr-2">
                    <span className="font-mono text-devflow-400 font-bold mr-1.5">#{dup.issueNumber}</span>
                    <span className="text-slate-200">{dup.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/issues/${dup.issueId}`);
                    }}
                    className="text-amber-400 hover:text-white flex items-center space-x-1 shrink-0 font-medium"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JWT token expiration returns HTTP 500 instead of 401"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Description <span className="text-rose-400">*</span>
              </label>

              {/* Auto-Triage Trigger */}
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={analyzing}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-slate-200 transition-colors disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5 text-devflow-400" />}
                <span>Auto-triage</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the steps to reproduce, actual vs expected behavior, or stack traces..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 transition-colors font-mono"
            />
          </div>

          {/* Analysis Preview Box */}
          {analysisResult && (
            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-devflow-400 flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Suggested Classification ({Math.round(analysisResult.confidence * 100)}% confidence)</span>
                </span>
                <span className="text-[10px] text-slate-400">Values applied to fields</span>
              </div>
              <p className="text-slate-300 mb-1.5">
                <strong>Root Cause:</strong> {analysisResult.possibleRootCause}
              </p>
              <div className="text-slate-400">
                <strong>Summary:</strong> {analysisResult.summary}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
              >
                <option value="BUG">BUG</option>
                <option value="FEATURE">FEATURE</option>
                <option value="IMPROVEMENT">IMPROVEMENT</option>
                <option value="DOCUMENTATION">DOCUMENTATION</option>
                <option value="TASK">TASK</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m?._id || m} value={m?._id || m}>
                    {m?.name || 'Developer'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Labels (comma separated)
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="backend, authentication, security"
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-dark-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-semibold rounded-xl bg-devflow-600 hover:bg-devflow-500 text-white shadow-md shadow-devflow-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Create Issue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
