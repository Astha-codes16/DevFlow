import React, { useState } from 'react';
import { X, Zap, GitPullRequest, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import api from '../services/api';

export default function WebhookSimulatorModal({ isOpen, onClose, onWebhookFired }) {
  const { activeProject } = useProject();

  const [action, setAction] = useState('closed');
  const [merged, setMerged] = useState(true);
  const [prNumber, setPrNumber] = useState(48);
  const [targetIssueNumber, setTargetIssueNumber] = useState(124);
  const [prTitle, setPrTitle] = useState('Fix JWT expiration handling in authMiddleware (Fixes #124)');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFireWebhook = async (e) => {
    e.preventDefault();
    if (!activeProject) {
      setError('Select an active project first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.post('/github/simulate-webhook', {
        projectId: activeProject._id,
        prNumber: Number(prNumber),
        action,
        merged,
        title: prTitle,
        body: `Fixes #${targetIssueNumber}. Catches TokenExpiredError specifically and responds with 401 instead of 500.`,
      });

      setResult(res.data);
      if (onWebhookFired) onWebhookFired(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to simulate webhook event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-dark-surface border border-dark-border shadow-2xl p-6 relative animate-in fade-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-hover"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-1 text-devflow-400">
          <Zap className="w-5 h-5" />
          <span className="font-bold text-lg text-white">GitHub Webhook Simulator</span>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Simulate inbound GitHub webhook payloads directly in local development without needing ngrok or a public URL.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleFireWebhook} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Event Action
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setMerged(e.target.value === 'closed');
                }}
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
              >
                <option value="closed">closed (Merged)</option>
                <option value="opened">opened</option>
                <option value="synchronize">synchronize (Commit pushed)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                PR Number
              </label>
              <input
                type="number"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Target Issue Number to Link/Close
            </label>
            <input
              type="number"
              value={targetIssueNumber}
              onChange={(e) => {
                setTargetIssueNumber(e.target.value);
                setPrTitle(`Fix JWT expiration handling in authMiddleware (Fixes #${e.target.value})`);
              }}
              className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              PR Title (with closing keyword)
            </label>
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-sm text-white focus:outline-none focus:border-devflow-500"
            />
          </div>

          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs animate-in fade-in duration-200">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Webhook event processed.</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                {result.result?.message || 'PR state updated.'}
              </p>
              {result.result?.linkedIssueNumbers?.length > 0 && (
                <div className="mt-1 text-slate-400">
                  Linked Issues: {result.result.linkedIssueNumbers.map((n) => `#${n}`).join(', ')} (marked RESOLVED if merged)
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-dark-hover"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-devflow-600 hover:bg-devflow-500 text-white transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Trigger Webhook</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
