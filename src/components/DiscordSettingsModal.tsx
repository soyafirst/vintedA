import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Bell, 
  Save 
} from 'lucide-react';
import { DiscordWebhooksConfig } from '../types';
import { sounds } from '../utils/audio';

export const DISCORD_WEBHOOKS_STORAGE_KEY = 'omnitool_discord_webhooks_v1';

const DEFAULT_CONFIG: DiscordWebhooksConfig = {
  webhook1_hunter: '',
  webhook2_legitCheck: '',
  webhook3_trends: '',
  autoSendHunter: false,
};

export const getDiscordConfig = (): DiscordWebhooksConfig => {
  try {
    const raw = localStorage.getItem(DISCORD_WEBHOOKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        webhook1_hunter: parsed.webhook1_hunter || localStorage.getItem('omnitool_vinted_discord_webhook_url') || '',
        webhook2_legitCheck: parsed.webhook2_legitCheck || '',
        webhook3_trends: parsed.webhook3_trends || '',
        autoSendHunter: typeof parsed.autoSendHunter === 'boolean' ? parsed.autoSendHunter : localStorage.getItem('omnitool_vinted_discord_enabled') === 'true',
      };
    }
    // Backward compatibility fallback
    const legacyUrl = localStorage.getItem('omnitool_vinted_discord_webhook_url') || '';
    const legacyEnabled = localStorage.getItem('omnitool_vinted_discord_enabled') === 'true';
    return {
      webhook1_hunter: legacyUrl,
      webhook2_legitCheck: '',
      webhook3_trends: '',
      autoSendHunter: legacyEnabled,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveDiscordConfig = (config: DiscordWebhooksConfig) => {
  try {
    localStorage.setItem(DISCORD_WEBHOOKS_STORAGE_KEY, JSON.stringify(config));
    // Also sync legacy keys for backward compatibility
    localStorage.setItem('omnitool_vinted_discord_webhook_url', config.webhook1_hunter);
    localStorage.setItem('omnitool_vinted_discord_enabled', String(config.autoSendHunter));
    window.dispatchEvent(new Event('discord-config-updated'));
  } catch {
    // ignore
  }
};

interface DiscordSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscordSettingsModal: React.FC<DiscordSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<DiscordWebhooksConfig>(DEFAULT_CONFIG);
  const [testStatus1, setTestStatus1] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [testStatus2, setTestStatus2] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [testStatus3, setTestStatus3] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getDiscordConfig());
      setSavedFeedback(false);
      setTestStatus1({ state: 'idle', message: '' });
      setTestStatus2({ state: 'idle', message: '' });
      setTestStatus3({ state: 'idle', message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveDiscordConfig(config);
    sounds.playSuccess();
    setSavedFeedback(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleTest1 = async () => {
    if (!config.webhook1_hunter.trim()) {
      setTestStatus1({ state: 'error', message: 'Veuillez saisir une URL de webhook valide' });
      return;
    }
    setTestStatus1({ state: 'loading', message: 'Envoi en cours...' });
    sounds.playClick();

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhook1_hunter.trim(),
          customPayload: {
            username: 'Anomaly Hunter · Test',
            avatar_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=128&q=80',
            embeds: [
              {
                title: '⚡ Test Connexion Webhook 1 : Anomaly Hunter',
                description: 'Le webhook Discord est opérationnel ! Les snipes détectés en temps réel seront dispatchés ici.',
                color: 0x10b981,
                fields: [
                  { name: 'Canal configuré', value: '🚨 Alertes Snipes en direct', inline: true },
                  { name: 'Statut', value: '✅ Opérationnel', inline: true },
                ],
                footer: { text: 'OmniTool · Vinted Reselling Pro' },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      if (res.ok) {
        setTestStatus1({ state: 'success', message: 'Message test envoyé avec succès !' });
        sounds.playSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        setTestStatus1({ state: 'error', message: err.error || 'Erreur lors de l’envoi' });
      }
    } catch (e: any) {
      setTestStatus1({ state: 'error', message: e.message || 'Erreur de connexion' });
    }
  };

  const handleTest2 = async () => {
    if (!config.webhook2_legitCheck.trim()) {
      setTestStatus2({ state: 'error', message: 'Veuillez saisir une URL de webhook valide' });
      return;
    }
    setTestStatus2({ state: 'loading', message: 'Envoi en cours...' });
    sounds.playClick();

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhook2_legitCheck.trim(),
          customPayload: {
            username: 'Vérif Authentique · Test',
            avatar_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=128&q=80',
            embeds: [
              {
                title: '🔍 Test Connexion Webhook 2 : Legit Check IA',
                description: 'Le canal de certification d’authenticité est connecté ! Vos futurs rapports d’analyses photo seront publiés ici.',
                color: 0x3b82f6,
                fields: [
                  { name: 'Canal configuré', value: '🔍 Rapports Legit Check', inline: true },
                  { name: 'Statut', value: '✅ Opérationnel', inline: true },
                ],
                footer: { text: 'OmniTool · Vinted Reselling Pro' },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      if (res.ok) {
        setTestStatus2({ state: 'success', message: 'Rapport test envoyé avec succès !' });
        sounds.playSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        setTestStatus2({ state: 'error', message: err.error || 'Erreur lors de l’envoi' });
      }
    } catch (e: any) {
      setTestStatus2({ state: 'error', message: e.message || 'Erreur de connexion' });
    }
  };

  const handleTest3 = async () => {
    if (!config.webhook3_trends.trim()) {
      setTestStatus3({ state: 'error', message: 'Veuillez saisir une URL de webhook valide' });
      return;
    }
    setTestStatus3({ state: 'loading', message: 'Envoi en cours...' });
    sounds.playClick();

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhook3_trends.trim(),
          customPayload: {
            username: 'Snipe du Mois · Test',
            avatar_url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=128&q=80',
            embeds: [
              {
                title: '📈 Test Connexion Webhook 3 : Tendances & Liquidité',
                description: 'Le canal de veille des tendances est connecté ! Le classement des pièces les plus rentables sera partagé ici.',
                color: 0x8b5cf6,
                fields: [
                  { name: 'Canal configuré', value: '📈 Tendances & Snipe du Mois', inline: true },
                  { name: 'Statut', value: '✅ Opérationnel', inline: true },
                ],
                footer: { text: 'OmniTool · Vinted Reselling Pro' },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      if (res.ok) {
        setTestStatus3({ state: 'success', message: 'Fiche tendance test envoyée !' });
        sounds.playSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        setTestStatus3({ state: 'error', message: err.error || 'Erreur lors de l’envoi' });
      }
    } catch (e: any) {
      setTestStatus3({ state: 'error', message: e.message || 'Erreur de connexion' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gestion des Webhooks Discord</h3>
              <p className="text-xs text-slate-400">Configurez 3 canaux Discord distincts et indépendants</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Webhook 1 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Webhook 1 : 🚨 Alertes Snipes en direct
                  </h4>
                  <p className="text-[11px] text-slate-400">Pour le radar Anomaly Hunter (détection -55% sous la côte)</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={config.webhook1_hunter}
                onChange={(e) => setConfig({ ...config, webhook1_hunter: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTest1}
                disabled={testStatus1.state === 'loading'}
                className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {testStatus1.state === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Tester</span>
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.autoSendHunter}
                onChange={(e) => setConfig({ ...config, autoSendHunter: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Alerter automatiquement Discord dès qu'un snipe franchit les filtres</span>
            </label>

            {testStatus1.state !== 'idle' && (
              <div
                className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  testStatus1.state === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : testStatus1.state === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {testStatus1.state === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testStatus1.message}</span>
              </div>
            )}
          </div>

          {/* Webhook 2 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-blue-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Webhook 2 : 🔍 Rapports Legit Check
                </h4>
                <p className="text-[11px] text-slate-400">Pour le module Vérif Authentique (rapport d'expertise complet)</p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={config.webhook2_legitCheck}
                onChange={(e) => setConfig({ ...config, webhook2_legitCheck: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTest2}
                disabled={testStatus2.state === 'loading'}
                className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {testStatus2.state === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Tester</span>
              </button>
            </div>

            {testStatus2.state !== 'idle' && (
              <div
                className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  testStatus2.state === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : testStatus2.state === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {testStatus2.state === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testStatus2.message}</span>
              </div>
            )}
          </div>

          {/* Webhook 3 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Webhook 3 : 📈 Tendances & Snipe du Mois
                </h4>
                <p className="text-[11px] text-slate-400">Pour le module Top Liquidité (palmarès mensuel & prix cibles)</p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={config.webhook3_trends}
                onChange={(e) => setConfig({ ...config, webhook3_trends: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTest3}
                disabled={testStatus3.state === 'loading'}
                className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {testStatus3.state === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Tester</span>
              </button>
            </div>

            {testStatus3.state !== 'idle' && (
              <div
                className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  testStatus3.state === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : testStatus3.state === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {testStatus3.state === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testStatus3.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <p className="text-xs text-slate-500">
            Enregistré dans le navigateur (LocalStorage)
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savedFeedback ? 'Enregistré !' : 'Enregistrer les 3 Webhooks'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
