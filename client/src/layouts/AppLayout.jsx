import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import CommandPalette from '../components/CommandPalette';
import CreateIssueModal from '../components/CreateIssueModal';
import WebhookSimulatorModal from '../components/WebhookSimulatorModal';
import { useProject } from '../context/ProjectContext';

export default function AppLayout() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isWebhookSimOpen, setIsWebhookSimOpen] = useState(false);
  const [creationNotice, setCreationNotice] = useState('');
  const { refreshActiveProject } = useProject();

  // Global keyboard shortcut for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleWebhookFired = () => {
    refreshActiveProject();
  };

  const handleIssueCreated = (_issue, warning) => {
    if (!warning) return;
    setCreationNotice(warning);
    window.setTimeout(() => setCreationNotice(''), 5000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-slate-100">
      <Navbar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenCreateIssue={() => setIsCreateIssueOpen(true)}
        onOpenWebhookSimulator={() => setIsWebhookSimOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-dark-bg/60">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {creationNotice && (
        <div role="status" className="fixed right-5 top-20 z-50 max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-xs text-amber-200 shadow-lg">
          {creationNotice}
        </div>
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenCreateIssue={() => setIsCreateIssueOpen(true)}
      />

      <CreateIssueModal
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        onCreated={handleIssueCreated}
      />

      <WebhookSimulatorModal
        isOpen={isWebhookSimOpen}
        onClose={() => setIsWebhookSimOpen(false)}
        onWebhookFired={handleWebhookFired}
      />
    </div>
  );
}
