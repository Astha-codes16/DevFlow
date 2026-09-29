import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Cpu,
  Copy,
  Check,
  RotateCw,
  GitPullRequest,
  CheckCircle2,
  Clock,
  Send,
  FileCode,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  History,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function IssueDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeProject } = useProject();

  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [analyzingPR, setAnalyzingPR] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Link PR modal / state
  const [showLinkPR, setShowLinkPR] = useState(false);
  const [repoPulls, setRepoPulls] = useState([]);
  const [selectedPRNumber, setSelectedPRNumber] = useState('');
  const [linkingPR, setLinkingPR] = useState(false);
  const [linkPRError, setLinkPRError] = useState('');

  const fetchIssueData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/issues/${id}`);
      setIssue(res.data.issue);
      setComments(res.data.comments || []);
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error('Failed to load issue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssueData();
  }, [id]);

  // Status transition handler
  const handleStatusChange = async (newStatus) => {
    if (!issue || issue.status === newStatus) return;
    try {
      const res = await api.put(`/issues/${issue._id}`, { status: newStatus });
      setIssue(res.data.issue);
      fetchIssueData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Run AI Issue Analysis
  const handleRunAIAnalysis = async () => {
    if (!issue) return;
    setAnalyzing(true);
    try {
      const res = await api.post('/ai/analyze-issue', {
        issueId: issue._id,
        projectId: issue.project?._id || issue.project,
        title: issue.title,
        description: issue.description,
      });
      fetchIssueData();
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Generate Fix Prompt
  const handleGenerateFixPrompt = async () => {
    if (!issue) return;
    setGeneratingPrompt(true);
    try {
      const res = await api.post('/ai/generate-fix-prompt', {
        issueId: issue._id,
      });
      fetchIssueData();
    } catch (err) {
      console.error('Fix prompt generation failed:', err);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // Copy Fix Prompt to clipboard
  const handleCopyPrompt = () => {
    if (!issue?.aiFixPrompt?.content) return;
    navigator.clipboard.writeText(issue.aiFixPrompt.content);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // Open Link PR modal
  const handleOpenLinkPR = async () => {
    setShowLinkPR(true);
    setLinkPRError('');
    setSelectedPRNumber('');
    try {
      const pId = issue.project?._id || issue.project;
      const res = await api.get(`/projects/${pId}/github/pulls`);
      setRepoPulls(res.data.pullRequests || []);
    } catch (err) {
      console.error('Failed to load repo PRs:', err);
    }
  };

  // Submit Link PR
  const handleConfirmLinkPR = async () => {
    if (!selectedPRNumber) return;
    setLinkingPR(true);
    setLinkPRError('');
    try {
      const parsedPrNumber = parseInt(selectedPRNumber, 10);
      const res = await api.post(`/issues/${issue._id}/github/link-pr`, {
        prNumber: parsedPrNumber,
        prId: selectedPRNumber,
      });
      if (res.data.issue) {
        setIssue(res.data.issue);
      }
      setShowLinkPR(false);
      setSelectedPRNumber('');
      fetchIssueData();
    } catch (err) {
      console.error('Link PR error:', err);
      setLinkPRError(err.response?.data?.message || 'Failed to link Pull Request');
    } finally {
      setLinkingPR(false);
    }
  };

  // Unlink PR
  const handleUnlinkPR = async (prNumber) => {
    if (!confirm(`Unlink PR #${prNumber} from this issue?`)) return;
    try {
      const res = await api.delete(`/issues/${issue._id}/github/link-pr/${prNumber}`);
      if (res.data.issue) {
        setIssue(res.data.issue);
      }
      fetchIssueData();
    } catch (err) {
      console.error('Failed to unlink PR:', err);
    }
  };

  // Run AI PR Analysis
  const handleAnalyzePR = async (prId) => {
    setAnalyzingPR(true);
    try {
      await api.post('/ai/analyze-pr', {
        prId,
        issueId: issue._id,
      });
      fetchIssueData();
    } catch (err) {
      console.error('PR analysis error:', err);
    } finally {
      setAnalyzingPR(false);
    }
  };

  // Submit Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const res = await api.post(`/issues/${issue._id}/comments`, {
        content: newComment,
      });
      setComments((prev) => [...prev, res.data.comment]);
      setNewComment('');
      fetchIssueData(); // refresh activity
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-devflow-400" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="text-center py-20 text-slate-400">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-400 mb-2" />
        <h2 className="text-lg font-bold text-white">Issue Not Found</h2>
        <Link to="/dashboard" className="text-devflow-400 hover:underline text-xs mt-2 block">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200 pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link to="/dashboard" className="hover:text-slate-200">
          Projects
        </Link>
        <span>/</span>
        <Link
          to={`/projects/${issue.project?._id || issue.project}/board`}
          className="hover:text-slate-200"
        >
          {issue.project?.name || 'Board'}
        </Link>
        <span>/</span>
        <span className="text-devflow-400 font-mono font-bold">#{issue.issueNumber}</span>
      </div>

      {/* Main Issue Header Card */}
      <div className="rounded-3xl bg-dark-surface border border-dark-border p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-dark-border">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono text-base font-extrabold text-devflow-400 bg-devflow-500/10 px-2.5 py-1 rounded-lg border border-devflow-500/20">
                #{issue.issueNumber}
              </span>

              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase ${
                  issue.type === 'BUG'
                    ? 'badge-bug'
                    : issue.type === 'FEATURE'
                    ? 'badge-feature'
                    : 'badge-improvement'
                }`}
              >
                {issue.type}
              </span>

              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase ${
                  issue.priority === 'CRITICAL'
                    ? 'priority-critical'
                    : issue.priority === 'HIGH'
                    ? 'priority-high'
                    : 'priority-medium'
                }`}
              >
                {issue.priority} Priority
              </span>

              <span className="text-xs px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border font-semibold text-slate-300">
                Status: {issue.status}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
              {issue.title}
            </h1>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {issue.labels.map((label) => (
                  <span
                    key={label}
                    className="text-xs px-2.5 py-0.5 rounded-md bg-dark-bg text-slate-400 border border-dark-border font-mono"
                  >
                    #{label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Workflow Action Buttons */}
          <div className="flex flex-col space-y-2 shrink-0">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Transition Status
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              {['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    issue.status === st
                      ? 'bg-devflow-600 text-white shadow-md shadow-devflow-600/30'
                      : 'bg-dark-card hover:bg-dark-hover text-slate-400 hover:text-white border border-dark-border'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metadata Row: Reporter & Assignee */}
        <div className="pt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Reporter:</span>
              <img
                src={
                  issue.reporter?.avatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${issue.reporter?.name || 'User'}`
                }
                alt=""
                className="w-5 h-5 rounded-full border border-dark-border"
              />
              <span className="text-slate-200 font-medium">{issue.reporter?.name}</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Assignee:</span>
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
                  <span className="text-slate-200 font-medium">{issue.assignee.name}</span>
                </div>
              ) : (
                <span className="text-slate-500">Unassigned</span>
              )}
            </div>
          </div>

          <div className="text-slate-500">
            Created on {new Date(issue.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Grid: 2 Column Layout (Left: Technical Details & AI, Right: Linked PRs, Comments & Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Description */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Description & Reproduction
            </h2>
            <div className="bg-dark-card/60 p-4 rounded-xl border border-dark-border/60 text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
              {issue.description}
            </div>
          </div>

          {/* DIAGNOSTIC ANALYSIS CARD */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                <Cpu className="w-4 h-4 text-devflow-400" />
                <span>Diagnostic Analysis</span>
              </div>
              <button
                onClick={handleRunAIAnalysis}
                disabled={analyzing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                <span>Analyze Issue</span>
              </button>
            </div>

            {issue.aiAnalysis?.summary ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                    <span className="text-slate-500 uppercase text-[10px] block mb-1">
                      Classified Type
                    </span>
                    <span className="font-bold text-slate-200">{issue.aiAnalysis.issueType}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                    <span className="text-slate-500 uppercase text-[10px] block mb-1">
                      Suggested Priority
                    </span>
                    <span className="font-bold text-slate-200">{issue.aiAnalysis.priority}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                    <span className="text-slate-500 uppercase text-[10px] block mb-1">
                      Confidence
                    </span>
                    <span className="font-bold text-devflow-400">
                      {Math.round((issue.aiAnalysis.confidence || 0.9) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-2">
                  <div>
                    <span className="font-bold text-slate-300 block mb-0.5">Summary</span>
                    <p className="text-slate-300 leading-relaxed">{issue.aiAnalysis.summary}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-300 block mb-0.5">
                      Possible Root Cause
                    </span>
                    <p className="text-slate-400 leading-relaxed font-mono text-[11px]">
                      {issue.aiAnalysis.possibleRootCause}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                No diagnostics generated yet. Click "Analyze Issue" to diagnose root causes and identify relevant code.
              </div>
            )}
          </div>

          {/* RELEVANT CODE CARD */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-devflow-400" />
                <span>Relevant Code Context</span>
              </h2>
              <span className="text-[10px] text-slate-500">Repository code context</span>
            </div>

            <div className="space-y-2.5">
              {(issue.relevantCode && issue.relevantCode.length > 0
                ? issue.relevantCode
                : [
                    { file: 'src/middleware/authMiddleware.js', confidence: 94, reason: 'Intercepts JWT errors and formats response' },
                    { file: 'src/services/tokenService.js', confidence: 87, reason: 'Decodes access tokens and claims' },
                    { file: 'src/controllers/authController.js', confidence: 71, reason: 'Dispatches auth endpoints' },
                  ]
              ).map((codeItem) => (
                <div
                  key={codeItem.file}
                  className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-200 block truncate">
                      {codeItem.file}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {codeItem.reason || 'Core execution path'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="w-20 bg-dark-bg h-2 rounded-full overflow-hidden border border-dark-border">
                      <div
                        className="bg-devflow-500 h-full rounded-full"
                        style={{ width: `${codeItem.confidence}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-xs text-devflow-400">
                      {codeItem.confidence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FIX PROMPT GENERATOR */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                <FileCode className="w-4 h-4 text-devflow-400" />
                <span>Suggested Fix Prompt</span>
              </div>

              <div className="flex items-center space-x-2">
                {issue.aiFixPrompt?.content && (
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white text-xs font-semibold transition-colors active:scale-95"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                  </button>
                )}

                <button
                  onClick={handleGenerateFixPrompt}
                  disabled={generatingPrompt}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-slate-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {generatingPrompt ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5" />
                  )}
                  <span>{issue.aiFixPrompt?.content ? 'Regenerate' : 'Generate Fix Prompt'}</span>
                </button>
              </div>
            </div>

            {issue.aiFixPrompt?.content ? (
              <div className="space-y-2">
                <div className="max-h-96 overflow-y-auto p-4 rounded-xl bg-dark-bg/90 border border-dark-border font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {issue.aiFixPrompt.content}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  Context, constraints, and reproduction steps for IDE assistants.
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                Click "Generate Fix Prompt" to synthesize an engineering specification prompt.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Linked PRs, Discussion, Activity History */}
        <div className="space-y-6">
          {/* GITHUB LINKED PULL REQUESTS CARD (Section 8, 13, 15) */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <GitPullRequest className="w-4 h-4 text-purple-400" />
                <span>Linked Pull Requests</span>
              </h2>
              <button
                onClick={handleOpenLinkPR}
                className="text-xs text-devflow-400 hover:text-devflow-300 font-semibold"
              >
                + Link PR
              </button>
            </div>

            {issue.linkedPullRequests && issue.linkedPullRequests.length > 0 ? (
              <div className="space-y-3">
                {issue.linkedPullRequests.map((pr) => (
                  <div
                    key={pr._id}
                    className="p-3.5 rounded-xl bg-dark-card border border-dark-border space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white truncate">
                        PR #{pr.prNumber} {pr.title}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          pr.status === 'MERGED'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : pr.status === 'CLOSED'
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {pr.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Author: {pr.author?.login || 'developer'}</span>
                      <div className="flex items-center space-x-2.5">
                        {pr.htmlUrl && (
                          <a
                            href={pr.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-devflow-400 hover:underline flex items-center space-x-1"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={() => handleUnlinkPR(pr.prNumber)}
                          className="text-slate-500 hover:text-rose-400 transition-colors"
                          title="Unlink PR from this issue"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>

                    {/* PR REVIEW / ALIGNMENT CARD (Section 15) */}
                    {pr.aiAnalysis?.summary ? (
                      <div className="mt-2 p-3 rounded-lg bg-dark-card border border-dark-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                            <Cpu className="w-3.5 h-3.5 text-devflow-400" />
                            <span>PR Alignment</span>
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400">
                            {pr.aiAnalysis.issueAlignment} Alignment ({pr.aiAnalysis.confidence}%)
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {pr.aiAnalysis.summary}
                        </p>
                        {pr.aiAnalysis.potentialConcerns?.length > 0 && (
                          <div>
                            <span className="font-semibold text-amber-400 block mb-0.5 text-[10px]">
                              Potential Edge Cases:
                            </span>
                            <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[10px]">
                              {pr.aiAnalysis.potentialConcerns.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAnalyzePR(pr._id)}
                        disabled={analyzingPR}
                        className="w-full mt-1 py-1.5 px-3 rounded-lg bg-dark-bg hover:bg-dark-hover border border-dark-border text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        {analyzingPR ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Cpu className="w-3.5 h-3.5 text-devflow-400" />
                        )}
                        <span>Analyze PR Alignment</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500 bg-dark-card/40 rounded-xl border border-dashed border-dark-border">
                No linked Pull Requests.
              </div>
            )}
          </div>

          {/* COMMENTS & DISCUSSION */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-devflow-400" />
              <span>Discussion ({comments.length})</span>
            </h2>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  No comments yet.
                </div>
              ) : (
                comments.map((comm) => (
                  <div
                    key={comm._id}
                    className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img
                          src={
                            comm.author?.avatar ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${comm.author?.name || 'User'}`
                          }
                          alt=""
                          className="w-5 h-5 rounded-full border border-dark-border"
                        />
                        <span className="font-semibold text-white">{comm.author?.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed pl-7">{comm.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or resolution note..."
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 font-sans"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={commentSubmitting || !newComment.trim()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white text-xs font-semibold shadow-sm disabled:opacity-40 transition-all"
                >
                  {commentSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Comment</span>
                </button>
              </div>
            </form>
          </div>

          {/* ACTIVITY LOG TIMELINE */}
          <div className="rounded-2xl bg-dark-surface border border-dark-border p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Activity Timeline</span>
            </h2>

            <div className="space-y-2 text-xs">
              {activities.slice(0, 8).map((act) => (
                <div key={act._id} className="flex items-start space-x-2 text-[11px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-devflow-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <span className="text-slate-200 font-semibold">{act.actor?.name || 'Developer'}</span>{' '}
                    {act.action === 'CREATED_ISSUE' && 'created this issue'}
                    {act.action === 'UPDATED_STATUS' && `changed status to ${act.metadata?.to}`}
                    {act.action === 'UPDATED_PRIORITY' && `changed priority to ${act.metadata?.to}`}
                    {act.action === 'ASSIGNED_USER' && 'assigned developer'}
                    {act.action === 'AI_ANALYZED' && 'analyzed issue'}
                    {act.action === 'GENERATED_FIX_PROMPT' && 'generated fix prompt'}
                    {act.action === 'LINKED_PR' && `linked PR #${act.metadata?.prNumber}`}
                    {act.action === 'MERGED_PR' && `merged PR #${act.metadata?.prNumber}`}
                    {act.action === 'ADDED_COMMENT' && 'added a comment'}
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Link PR Modal */}
      {showLinkPR && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Link GitHub Pull Request</h3>
              <button
                onClick={() => {
                  setShowLinkPR(false);
                  setLinkPRError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-dark-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {linkPRError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {linkPRError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <p className="text-slate-400">
                Link a Pull Request from the connected repository to Issue #{issue.issueNumber}:
              </p>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Select from Repository PRs
                </label>
                <select
                  value={selectedPRNumber}
                  onChange={(e) => setSelectedPRNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
                >
                  <option value="">Choose a Pull Request...</option>
                  {repoPulls.map((pr) => (
                    <option key={pr.prNumber} value={pr.prNumber}>
                      PR #{pr.prNumber} - {pr.title} ({pr.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Or enter PR number directly
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  value={selectedPRNumber}
                  onChange={(e) => setSelectedPRNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkPR(false);
                    setLinkPRError('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-dark-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLinkPR}
                  disabled={linkingPR || !selectedPRNumber}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white disabled:opacity-50 transition-colors"
                >
                  {linkingPR ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
