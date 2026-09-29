import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Workflow,
  Search,
  Bell,
  Plus,
  ChevronDown,
  CheckCheck,
  LogOut,
  FolderGit2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function Navbar({ onOpenCommandPalette, onOpenCreateIssue, onOpenWebhookSimulator }) {
  const { user, logout } = useAuth();
  const { projects, activeProject, selectProject } = useProject();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const notifRef = useRef(null);
  const projectRef = useRef(null);
  const userRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target)) {
        setShowProjectDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await api.patch(`/notifications/${notif._id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error(err);
      }
    }
    setShowNotifications(false);
    if (notif.issue) {
      navigate(`/issues/${notif.issue._id || notif.issue}`);
    }
  };

  return (
    <header className="h-16 border-b border-dark-border bg-dark-bg/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center space-x-6">
        <Link to="/dashboard" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-devflow-600 flex items-center justify-center text-white">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            DevFlow
          </span>
        </Link>

        {/* Project Selector Dropdown */}
        <div className="relative" ref={projectRef}>
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-surface hover:bg-dark-hover border border-dark-border transition-colors text-sm font-medium"
          >
            <FolderGit2 className="w-4 h-4 text-devflow-400" />
            <span className="max-w-[140px] truncate text-slate-200">
              {activeProject ? activeProject.name : 'Select Project'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showProjectDropdown && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-dark-surface border border-dark-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-dark-border/60">
                Projects
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {projects.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => {
                      selectProject(p);
                      setShowProjectDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-dark-hover transition-colors ${
                      activeProject?._id === p._id ? 'bg-devflow-500/10 text-devflow-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-dark-card text-slate-400 border border-dark-border">
                      {p.key}
                    </span>
                  </button>
                ))}
              </div>
              <div className="pt-1.5 border-t border-dark-border/60">
                <Link
                  to="/projects"
                  onClick={() => setShowProjectDropdown(false)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-hover flex items-center justify-between"
                >
                  Manage all projects
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Command Palette Trigger */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-dark-surface/90 hover:bg-dark-surface border border-dark-border text-slate-400 hover:text-slate-200 text-sm transition-all group"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-500 group-hover:text-devflow-400 transition-colors" />
            <span className="text-slate-400">Search issues, actions, code...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-dark-bg rounded border border-dark-border">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Notifications & Profile */}
      <div className="flex items-center space-x-3">
        {/* Simulate Webhook Button */}
        <button
          onClick={onOpenWebhookSimulator}
          title="Simulate GitHub Webhook"
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-dark-surface hover:bg-dark-hover text-slate-300 border border-dark-border transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          <span>Webhook Sim</span>
        </button>

        {/* New Issue Button */}
        <button
          onClick={onOpenCreateIssue}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Issue</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-surface border border-transparent hover:border-dark-border transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-devflow-500 ring-4 ring-dark-bg"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-dark-surface border border-dark-border shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-dark-border">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-devflow-500/10 text-devflow-400 border border-devflow-500/20">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-slate-400 hover:text-devflow-400 flex items-center space-x-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-2.5 rounded-lg cursor-pointer text-left transition-colors ${
                        notif.read
                          ? 'bg-dark-card/40 hover:bg-dark-card text-slate-400'
                          : 'bg-devflow-500/10 hover:bg-devflow-500/15 text-slate-200 border border-devflow-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-white">{notif.title}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center space-x-2 pl-2 focus:outline-none"
          >
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`}
              alt={user?.name}
              className="w-8 h-8 rounded-full border border-dark-border object-cover"
            />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-dark-surface border border-dark-border shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-dark-border/60">
                <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
                <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-devflow-500/15 text-devflow-400 border border-devflow-500/30">
                  {user?.role}
                </span>
              </div>
              <div className="py-1">
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
