import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Users,
  Settings,
  ArrowRight,
  ExternalLink,
  Shield,
  Loader2,
  X,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProjectsPage() {
  const { projects, selectProject, fetchProjects } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/projects', {
        name,
        key: key.toUpperCase(),
        description,
      });
      await fetchProjects();
      selectProject(res.data.project);
      setShowCreateModal(false);
      navigate(`/projects/${res.data.project._id}/board`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage projects and repository integrations.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-slate-500 rounded-xl bg-dark-surface border border-dark-border">
            <FolderGit2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300 mb-1">No projects yet</p>
            <p className="text-slate-400">Create a project to start tracking issues.</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project._id}
              className="rounded-xl bg-dark-surface border border-dark-border hover:border-devflow-500/40 p-5 shadow-sm flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-devflow-400 bg-devflow-500/10 px-2 py-0.5 rounded border border-devflow-500/20">
                    {project.key}
                  </span>

                  <div className="flex items-center space-x-1 text-xs text-slate-400">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        project.githubRepository?.connected ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    <span>{project.githubRepository?.connected ? 'GitHub' : 'Local'}</span>
                  </div>
                </div>

                <h2 className="font-bold text-base text-white group-hover:text-devflow-300 transition-colors">
                  {project.name}
                </h2>

                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>

                {project.githubRepository?.connected && (
                  <div className="mt-3 flex items-center space-x-1.5 text-xs text-devflow-400 font-mono">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {project.githubRepository.owner}/{project.githubRepository.repo}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-dark-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>{project.members?.length || 1} members</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    to={`/projects/${project._id}`}
                    title="Project Settings"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-hover transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => {
                      selectProject(project);
                      navigate(`/projects/${project._id}/board`);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover text-devflow-400 font-semibold border border-dark-border transition-colors"
                  >
                    <span>Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-bold text-lg text-white mb-1">Create Project</h2>
            <p className="text-xs text-slate-400 mb-5">
              Set up a project to track issues and link repositories.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!key && e.target.value.length >= 3) {
                      setKey(e.target.value.substring(0, 4).toUpperCase());
                    }
                  }}
                  placeholder="e.g. Auth Microservice"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Project Key (e.g. AUTH) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="AUTH"
                  maxLength={6}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white font-mono uppercase focus:outline-none focus:border-devflow-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this repository responsible for?"
                  className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-dark-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 font-semibold rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
