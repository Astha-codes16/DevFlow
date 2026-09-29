import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitPullRequest,
  GitBranch,
  GitCommit,
  Star,
  GitFork,
  ExternalLink,
  RotateCw,
  Unlink,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  Loader2,
  X,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function GitHubProjectPage() {
  const { id: routeProjectId } = useParams();
  const { activeProject, refreshActiveProject } = useProject();
  const { user } = useAuth();
  const projectId = routeProjectId || activeProject?._id;

  const [activeTab, setActiveTab] = useState('pulls'); // pulls, branches, commits
  const [repoData, setRepoData] = useState(null);
  const [pulls, setPulls] = useState([]);
  const [branches, setBranches] = useState([]);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Connect form state
  const [ownerInput, setOwnerInput] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected PR for detail drawer
  const [selectedPR, setSelectedPR] = useState(null);
  const [prFiles, setPrFiles] = useState([]);
  const [prCommits, setPrCommits] = useState([]);
  const [loadingPRDetails, setLoadingPRDetails] = useState(false);

  const fetchRepoInfo = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/projects/${projectId}/github`);
      if (res.data.connected && res.data.repository) {
        setRepoData(res.data.repository);
        // Load PRs, branches, and commits in parallel
        loadSubTabData(res.data.repository);
      } else {
        setRepoData(null);
      }
    } catch (err) {
      console.error('Failed to load GitHub data:', err);
      setError(err.response?.data?.message || 'Could not load GitHub repository data');
    } finally {
      setLoading(false);
    }
  };

  const loadSubTabData = async () => {
    try {
      const [pullsRes, branchesRes, commitsRes] = await Promise.allSettled([
        api.get(`/projects/${projectId}/github/pulls`),
        api.get(`/projects/${projectId}/github/branches`),
        api.get(`/projects/${projectId}/github/commits`),
      ]);

      if (pullsRes.status === 'fulfilled') {
        setPulls(pullsRes.value.data.pullRequests || []);
      }
      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.data.branches || []);
      }
      if (commitsRes.status === 'fulfilled') {
        setCommits(commitsRes.value.data.commits || []);
      }
    } catch (err) {
      console.error('Failed to load sub-tab data:', err);
    }
  };

  useEffect(() => {
    fetchRepoInfo();
  }, [projectId]);

  const normalizeGithubInput = (ownerVal, repoVal) => {
    let owner = (ownerVal || '').trim();
    let repo = (repoVal || '').trim();

    if (repo.includes('github.com')) {
      const cleaned = repo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
      const parts = cleaned.split('/').filter(Boolean);
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      } else if (parts.length === 1) {
        repo = parts[0];
      }
    } else if (repo.includes('/')) {
      const parts = repo.split('/').filter(Boolean);
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }
    }

    if (owner.includes('github.com')) {
      const cleaned = owner.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
      const parts = cleaned.split('/').filter(Boolean);
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }
    } else if (owner.includes('/')) {
      const parts = owner.split('/').filter(Boolean);
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }
    }

    return { owner, repo };
  };

  const handleOwnerChange = (val) => {
    if (val.includes('github.com') || val.includes('/')) {
      const { owner, repo } = normalizeGithubInput(val, repoInput);
      setOwnerInput(owner);
      if (repo) setRepoInput(repo);
      return;
    }
    setOwnerInput(val);
  };

  const handleRepoChange = (val) => {
    if (val.includes('github.com') || val.includes('/')) {
      const { owner, repo } = normalizeGithubInput(ownerInput, val);
      if (owner) setOwnerInput(owner);
      setRepoInput(repo);
      return;
    }
    setRepoInput(val);
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    const { owner, repo } = normalizeGithubInput(ownerInput, repoInput);
    setOwnerInput(owner);
    setRepoInput(repo);

    if (!owner || !repo) {
      setError('Please provide both GitHub owner and repository name');
      return;
    }

    setConnecting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.post(`/projects/${projectId}/github/connect`, {
        owner,
        repo,
      });
      setSuccessMsg(`Connected to ${owner}/${repo}.`);
      await refreshActiveProject();
      await fetchRepoInfo();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to connect to GitHub repository. Verify that owner and repository name exist.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this GitHub repository?')) return;
    try {
      await api.delete(`/projects/${projectId}/github/disconnect`);
      setRepoData(null);
      setPulls([]);
      setBranches([]);
      setCommits([]);
      await refreshActiveProject();
      setSuccessMsg('Repository disconnected.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disconnect repository');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await api.get(`/projects/${projectId}/github/pulls?sync=true`);
      if (res.data.pullRequests) {
        setPulls(res.data.pullRequests);
      }
      await loadSubTabData();
      setSuccessMsg('Synchronized pull requests and commits from GitHub.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectPR = async (pr) => {
    setSelectedPR(pr);
    setLoadingPRDetails(true);
    try {
      const [filesRes, commitsRes] = await Promise.allSettled([
        api.get(`/projects/${projectId}/github/pulls/${pr.prNumber}/files`),
        api.get(`/projects/${projectId}/github/pulls/${pr.prNumber}/commits`),
      ]);

      if (filesRes.status === 'fulfilled') {
        setPrFiles(filesRes.value.data.files || []);
      }
      if (commitsRes.status === 'fulfilled') {
        setPrCommits(commitsRes.value.data.commits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPRDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-devflow-400" />
      </div>
    );
  }

  // DISCONNECTED STATE (Section 27)
  if (!repoData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-dark-surface border border-dark-border text-slate-200 mb-2">
            <GithubIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect GitHub Repository</h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Link a GitHub repository to track pull requests, inspect branches and commits, view file changes, and synchronize webhooks.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
            {successMsg}
          </div>
        )}

        {/* Feature checklist box (Section 27) */}
        <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Repository features
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pull request tracking and status updates</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Automatic issue linking via PR title or description (e.g. <code>Fixes #124</code>)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Changed files and diff inspection for PR analysis</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Branch and commit history</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Automated issue resolution on PR merge</span>
            </li>
          </ul>

          <form onSubmit={handleConnect} className="pt-4 border-t border-dark-border space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  GitHub Owner / Org <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  placeholder="e.g. Astha-codes16 or facebook"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Repository Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  placeholder="e.g. BlogIt or react"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Supports public repositories and private repositories with configured access tokens.
              </span>
              <button
                type="submit"
                disabled={connecting}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-devflow-600 hover:bg-devflow-500 text-white font-semibold text-xs shadow-md shadow-devflow-600/30 disabled:opacity-50 transition-all"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GithubIcon className="w-4 h-4" />}
                <span>Connect Repository</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // CONNECTED STATE (Section 1, 5, 6, 7, 19)
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-white p-1 rounded hover:bg-dark-hover">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white p-1 rounded hover:bg-dark-hover">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Repository Card */}
      <div className="rounded-3xl bg-dark-surface border border-dark-border p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-dark-border">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected</span>
              </span>
              <span className="text-xs text-slate-500 font-mono">
                default: {repoData.defaultBranch || 'main'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <GithubIcon className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {repoData.fullName || `${repoData.owner}/${repoData.name}`}
              </h1>
            </div>

            {repoData.description && (
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                {repoData.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            <a
              href={repoData.url || `https://github.com/${repoData.owner}/${repoData.name}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-devflow-600/20 hover:bg-devflow-600/30 border border-devflow-500/30 text-devflow-400 hover:text-white text-xs font-semibold transition-colors"
            >
              <span>View on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleDisconnect}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors"
              title="Disconnect Repository"
            >
              <Unlink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Repository Stats Badges (Section 5) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center space-x-2.5">
            <Star className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Stars</span>
              <span className="font-bold text-white">{repoData.stars || 0}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center space-x-2.5">
            <GitFork className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Forks</span>
              <span className="font-bold text-white">{repoData.forks || 0}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center space-x-2.5">
            <GitPullRequest className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Pull Requests</span>
              <span className="font-bold text-white">{pulls.length}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center space-x-2.5">
            <GitBranch className="w-4 h-4 text-devflow-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Branches</span>
              <span className="font-bold text-white">{branches.length || 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center space-x-2 border-b border-dark-border pb-3">
        <button
          onClick={() => setActiveTab('pulls')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'pulls'
              ? 'bg-devflow-600 text-white shadow-md shadow-devflow-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-surface'
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          <span>Pull Requests ({pulls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'branches'
              ? 'bg-devflow-600 text-white shadow-md shadow-devflow-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-surface'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Branches ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('commits')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'commits'
              ? 'bg-devflow-600 text-white shadow-md shadow-devflow-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-surface'
          }`}
        >
          <GitCommit className="w-4 h-4" />
          <span>Recent Commits ({commits.length})</span>
        </button>
      </div>

      {/* TAB CONTENT: PULL REQUESTS */}
      {activeTab === 'pulls' && (
        <div className="space-y-3">
          {pulls.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-dark-surface border border-dark-border">
              No pull requests found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {pulls.map((pr) => (
                <div
                  key={pr.prNumber}
                  className="p-4 rounded-2xl bg-dark-surface hover:bg-dark-hover border border-dark-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-purple-400">
                        #{pr.prNumber}
                      </span>
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
                      <span className="text-[11px] text-slate-400 font-mono">
                        {pr.headBranch} → {pr.baseBranch}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-white group-hover:text-devflow-300 transition-colors truncate">
                      {pr.title}
                    </h3>

                    <div className="flex items-center space-x-4 text-[11px] text-slate-400">
                      <span>Author: {pr.author?.login}</span>
                      <span>
                        Updated {new Date(pr.updatedAt || pr.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleSelectPR(pr)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-dark-card hover:bg-dark-card/80 text-slate-200 border border-dark-border transition-colors"
                    >
                      View Details & Files
                    </button>

                    <a
                      href={pr.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-card transition-colors"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: BRANCHES */}
      {activeTab === 'branches' && (
        <div className="rounded-2xl bg-dark-surface border border-dark-border divide-y divide-dark-border/60 overflow-hidden shadow-sm">
          {branches.map((b) => (
            <div key={b.name} className="p-3.5 flex items-center justify-between text-xs hover:bg-dark-hover">
              <div className="flex items-center space-x-2.5">
                <GitBranch className="w-4 h-4 text-devflow-400" />
                <span className="font-mono font-semibold text-slate-200">{b.name}</span>
                {b.name === repoData.defaultBranch && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-devflow-500/15 text-devflow-400 border border-devflow-500/30">
                    default
                  </span>
                )}
                {b.protected && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    protected
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                {b.sha ? b.sha.substring(0, 7) : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: COMMITS */}
      {activeTab === 'commits' && (
        <div className="rounded-2xl bg-dark-surface border border-dark-border divide-y divide-dark-border/60 overflow-hidden shadow-sm">
          {commits.map((c) => (
            <div key={c.sha} className="p-3.5 flex items-center justify-between text-xs hover:bg-dark-hover gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <GitCommit className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{c.message}</div>
                  <div className="text-[10px] text-slate-400">
                    {c.author?.name} committed on {new Date(c.author?.date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="font-mono text-[11px] text-devflow-400 bg-devflow-500/10 px-2 py-0.5 rounded border border-devflow-500/20">
                  {c.shortSha}
                </span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PR DETAIL MODAL / DRAWER */}
      {selectedPR && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-dark-surface border border-dark-border shadow-2xl p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPR(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded hover:bg-dark-hover"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-mono text-sm font-bold text-purple-400">
                    PR #{selectedPR.prNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      selectedPR.status === 'MERGED'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {selectedPR.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedPR.title}</h2>
                <div className="text-xs text-slate-400 mt-1">
                  Author: <span className="text-slate-200">{selectedPR.author?.login}</span> • Branch: <span className="font-mono text-devflow-400">{selectedPR.headBranch}</span> → <span className="font-mono text-slate-300">{selectedPR.baseBranch}</span>
                </div>
              </div>

              {selectedPR.body && (
                <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-xs text-slate-300 font-mono whitespace-pre-wrap">
                  {selectedPR.body}
                </div>
              )}

              {/* Changed files */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Changed Files ({prFiles.length})</span>
                  {loadingPRDetails && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {prFiles.map((file) => (
                    <div
                      key={file.filename}
                      className="p-2.5 rounded-lg bg-dark-card border border-dark-border text-xs flex items-center justify-between font-mono"
                    >
                      <span className="text-slate-200 truncate">{file.filename}</span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-emerald-400">+{file.additions}</span>
                        <span className="text-rose-400">-{file.deletions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                <a
                  href={selectedPR.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-devflow-400 hover:underline flex items-center space-x-1"
                >
                  <span>Open PR on GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => setSelectedPR(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-dark-card hover:bg-dark-hover text-white border border-dark-border"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
