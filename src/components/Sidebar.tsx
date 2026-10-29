import React from 'react';
import { 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  ChevronRight,
  Shield,
  Tag,
  Settings
} from 'lucide-react';
import { AppModule } from '../types';
import { sounds } from '../utils/audio';

interface SidebarProps {
  activeModule: AppModule;
  setActiveModule: (module: AppModule) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenSettings?: () => void;
}

interface NavItem {
  id: AppModule;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'hunter',
    label: 'Anomaly Hunter',
    tagline: 'Radar en direct & Multi-catalogues',
    icon: Zap,
    accentColor: 'text-amber-400 group-hover:text-amber-300',
    badge: 'LIVE',
  },
  {
    id: 'bargains',
    label: 'Invendus & Affaires',
    tagline: 'Deep Search & Négociation -40%',
    icon: Tag,
    accentColor: 'text-emerald-400 group-hover:text-emerald-300',
    badge: 'DEEP',
  },
  {
    id: 'legit_check',
    label: 'Vérif Authentique',
    tagline: 'Legit Check IA par analyse photo',
    icon: ShieldCheck,
    accentColor: 'text-blue-400 group-hover:text-blue-300',
    badge: 'IA',
  },
  {
    id: 'trends',
    label: 'Snipe du Mois',
    tagline: 'Top Liquidité & Prix cibles',
    icon: TrendingUp,
    accentColor: 'text-purple-400 group-hover:text-purple-300',
    badge: 'PRO',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  mobileOpen,
  setMobileOpen,
  onOpenSettings,
}) => {
  const handleSelect = (id: AppModule) => {
    setActiveModule(id);
    setMobileOpen(false);
    sounds.playClick();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 border-r border-white/5 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand Header */}
          <div className="h-18 px-6 flex items-center gap-3 border-b border-white/5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight uppercase flex items-center gap-1.5">
                <span>Vinted Pro</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  SUITE
                </span>
              </h1>
              <p className="text-xs text-slate-400 truncate">Achat & Revente Optimisé</p>
            </div>
          </div>

          {/* Module Navigation List */}
          <div className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Modules Spécialisés
            </div>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full group text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-slate-900 border border-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? item.id === 'hunter'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : item.id === 'bargains'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.id === 'legit_check'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-900/60 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded ${
                              item.badge === 'LIVE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.badge === 'DEEP'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.badge === 'IA'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.tagline}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 transition-transform shrink-0 ${
                      isActive
                        ? 'text-amber-400 translate-x-0.5'
                        : 'text-slate-600 group-hover:text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Quick Webhooks Access Button */}
          {onOpenSettings && (
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onOpenSettings();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform" />
                  <span>3 Webhooks Discord</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  Config
                </span>
              </button>
            </div>
          )}

          {/* System status footer */}
          <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Flux Vinted Live</span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connecté
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Anti-CORS proxy actif · Zéro mock data.</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span>Dark Mode Pro</span>
              <span>v3.0.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
