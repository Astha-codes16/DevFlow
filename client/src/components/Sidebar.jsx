import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  ListTodo,
  BarChart3,
  Settings,
  FolderGit2,
  GitPullRequest,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export default function Sidebar() {
  const { activeProject } = useProject();

  const projectId = activeProject?._id;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: projectId ? `/projects/${projectId}/board` : '/projects',
      label: 'Board',
      icon: Kanban,
      disabled: !projectId,
    },
    {
      to: projectId ? `/projects/${projectId}/issues` : '/projects',
      label: 'Issues',
      icon: ListTodo,
      disabled: !projectId,
    },
    {
      to: projectId ? `/projects/${projectId}/analytics` : '/projects',
      label: 'Analytics',
      icon: BarChart3,
      disabled: !projectId,
    },
    {
      to: projectId ? `/projects/${projectId}/github` : '/projects',
      label: 'GitHub Integration',
      icon: GitPullRequest,
      disabled: !projectId,
    },
    {
      to: projectId ? `/projects/${projectId}` : '/projects',
      label: 'Settings',
      icon: Settings,
      disabled: !projectId,
    },
    {
      to: '/projects',
      label: 'All Projects',
      icon: FolderGit2,
    },
  ];

  return (
    <aside className="w-64 bg-dark-bg/95 border-r border-dark-border flex flex-col justify-between p-4 shrink-0 select-none">
      <div className="space-y-6">
        {/* Project Context Badge */}
        {activeProject ? (
          <div className="p-3 rounded-xl bg-dark-surface/80 border border-dark-border">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
              <span>Active Workspace</span>
              <span className="text-devflow-400 font-mono text-[10px] bg-devflow-500/10 px-1.5 py-0.5 rounded border border-devflow-500/20">
                {activeProject.key}
              </span>
            </div>
            <div className="font-semibold text-sm text-white truncate">{activeProject.name}</div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-2">
              <span className={`w-2 h-2 rounded-full ${activeProject.githubRepository?.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'}`}></span>
              <span className="text-[11px] truncate">
                {activeProject.githubRepository?.connected
                  ? `${activeProject.githubRepository.owner}/${activeProject.githubRepository.repo}`
                  : 'No GitHub connected'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-dark-surface/50 border border-dark-border text-xs text-slate-400 text-center">
            No active project selected
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-1">
          <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Workflow
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-devflow-600/15 text-devflow-400 border border-devflow-500/25 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-surface'
                  } ${item.disabled ? 'opacity-40 pointer-events-none' : ''}`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Keyboard Shortcut Hint */}
      <div className="px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-xs text-slate-400 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Command menu</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-dark-card border border-dark-border rounded text-slate-400">
          Ctrl K
        </kbd>
      </div>
    </aside>
  );
}
