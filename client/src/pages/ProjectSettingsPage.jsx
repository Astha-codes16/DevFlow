import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  Users,
  Shield,
  Trash2,
  Check,
  Loader2,
  UserPlus,
  GitBranch,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function ProjectSettingsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { selectProject, fetchProjects } = useProject();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // GitHub connection form state
  const [ghOwner, setGhOwner] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [connectingGH, setConnectingGH] = useState(false);

  // Add Member state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('DEVELOPER');
  const [addingMember, setAddingMember] = useState(false);

  // Status message
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [projRes, usersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get('/auth/users'),
      ]);
      const p = projRes.data.project;
      setProject(p);
      setAllUsers(usersRes.data.users || []);

      if (p.githubRepository?.connected) {
        setGhOwner(p.githubRepository.owner || '');
        setGhRepo(p.githubRepository.repo || '');
      }
    } catch (err) {
      console.error('Failed to load project settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const normalizeGithubInput = (ownerInput, repoInput) => {
    let owner = (ownerInput || '').trim();
    let repo = (repoInput || '').trim();

    // If repo is a full URL: https://github.com/owner/repo
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

    // If owner is a full URL: https://github.com/owner/repo
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
      const { owner, repo } = normalizeGithubInput(val, ghRepo);
      setGhOwner(owner);
      if (repo) setGhRepo(repo);
      return;
    }
    setGhOwner(val);
  };

  const handleRepoChange = (val) => {
    if (val.includes('github.com') || val.includes('/')) {
      const { owner, repo } = normalizeGithubInput(ghOwner, val);
      if (owner) setGhOwner(owner);
      setGhRepo(repo);
      return;
    }
    setGhRepo(val);
  };

  const handleConnectGitHub = async (e) => {
    e.preventDefault();
    setConnectingGH(true);
    setError('');
    setMessage('');

    const { owner, repo } = normalizeGithubInput(ghOwner, ghRepo);
    setGhOwner(owner);
    setGhRepo(repo);

    try {
      const res = await api.post(`/projects/${id}/github/connect`, {
        owner,
        repo,
      });
      setMessage(`Connected to ${owner}/${repo}.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect repository');
    } finally {
      setConnectingGH(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      await api.post(`/projects/${id}/members`, {
        userId: selectedUserId,
        role: selectedRole,
      });
      setMessage('Member added successfully');
      setSelectedUserId('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove member from this project?')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${project.name}"?`)) return;
    try {
      await api.delete(`/projects/${id}`);
      await fetchProjects();
      navigate('/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-devflow-400" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-20 text-slate-400">Project not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Project Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage project settings, GitHub repository connection, and collaborators.
        </p>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* GitHub Integration Card */}
      <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5 text-white font-bold text-sm">
          <GithubIcon className="w-5 h-5 text-slate-300" />
          <span>GitHub Repository Connection</span>
        </div>
        <p className="text-xs text-slate-400">
          Connect your GitHub repository to enable automatic PR linking, file tree inspection for relevant code context, and automated status transitions on merged PRs.
        </p>

        <form onSubmit={handleConnectGitHub} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Owner / Organization
              </label>
              <input
                type="text"
                value={ghOwner}
                onChange={(e) => handleOwnerChange(e.target.value)}
                placeholder="e.g. octocat"
                required
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
                placeholder="e.g. hello-world"
                required
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Webhook URL: <code className="bg-dark-bg px-1.5 py-0.5 rounded text-devflow-400">/api/github/webhook</code>
            </span>
            <button
              type="submit"
              disabled={connectingGH}
              className="px-4 py-2 font-semibold text-xs rounded-xl bg-devflow-600 hover:bg-devflow-500 text-white transition-colors disabled:opacity-50"
            >
              {connectingGH ? 'Connecting...' : project.githubRepository?.connected ? 'Update Repository' : 'Connect Repository'}
            </button>
          </div>
        </form>
      </div>

      {/* Team Members Card */}
      <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5 text-white font-bold text-sm">
          <Users className="w-5 h-5 text-devflow-400" />
          <span>Collaborators</span>
        </div>

        {/* Members List */}
        <div className="divide-y divide-dark-border/60">
          {project.members?.map((m) => (
            <div key={m.user?._id || m.user} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <img
                  src={
                    m.user?.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${m.user?.name || 'User'}`
                  }
                  alt=""
                  className="w-8 h-8 rounded-full border border-dark-border"
                />
                <div>
                  <div className="font-semibold text-white">{m.user?.name}</div>
                  <div className="text-[11px] text-slate-400">{m.user?.email}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-card border border-dark-border text-slate-300">
                  {m.role}
                </span>

                {m.user?._id !== project.owner?._id && (
                  <button
                    onClick={() => handleRemoveMember(m.user?._id)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Member form */}
        <form onSubmit={handleAddMember} className="pt-3 border-t border-dark-border flex items-center space-x-3 text-xs">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-white focus:outline-none focus:border-devflow-500"
          >
            <option value="">Select a user to invite...</option>
            {allUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-32 px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-white focus:outline-none focus:border-devflow-500"
          >
            <option value="DEVELOPER">DEVELOPER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="VIEWER">VIEWER</option>
          </select>

          <button
            type="submit"
            disabled={addingMember || !selectedUserId}
            className="px-4 py-2 font-semibold rounded-xl bg-devflow-600 hover:bg-devflow-500 text-white shadow-sm disabled:opacity-40"
          >
            Add Member
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl bg-rose-950/20 border border-rose-500/30 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-300">
            <span className="font-semibold block text-white">Delete Project</span>
            Permanently remove this project, issues, pull requests, and activity history.
          </div>
          <button
            onClick={handleDeleteProject}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
