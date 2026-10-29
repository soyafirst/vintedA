import React from 'react';
import { Menu, Zap, ShieldCheck, TrendingUp, Settings, Moon, Tag } from 'lucide-react';
import { AppModule } from '../types';
import { sounds } from '../utils/audio';

interface HeaderProps {
  activeModule: AppModule;
  setActiveModule: (m: AppModule) => void;
  onOpenMobileMenu: () => void;
  onOpenSettings: () => void;
}

const MODULE_NAMES: Record<AppModule, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  hunter: {
    title: 'Anomaly Hunter',
    subtitle: 'Radar Live & Multi-Catalogues',
    icon: Zap,
  },
  bargains: {
    title: 'Invendus & Bonnes Affaires',
    subtitle: 'Deep Search Vinted & Négociation -40%',
    icon: Tag,
  },
  legit_check: {
    title: 'Vérif Authentique',
    subtitle: 'Legit Check IA par Analyse Photo',
    icon: ShieldCheck,
  },
  trends: {
    title: 'Snipe du Mois',
    subtitle: 'Top Liquidité & Prix Cibles Vinted',
    icon: TrendingUp,
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  setActiveModule,
  onOpenMobileMenu,
  onOpenSettings,
}) => {
  const current = MODULE_NAMES[activeModule] || MODULE_NAMES.hunter;
  const Icon = current.icon;

  const handleTabChange = (mod: AppModule) => {
    sounds.playClick();
    setActiveModule(mod);
  };

  return (
    <header className="h-18 px-4 sm:px-6 bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-30 flex items-center justify-between gap-4">
      {/* Left zone: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white lg:hidden"
          title="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 shrink-0 hidden sm:flex">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white truncate">
                {current.title}
              </h2>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate">
                {current.subtitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle zone: Navigation tabs for large screens */}
      <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800/80">
        <button
          onClick={() => handleTabChange('hunter')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeModule === 'hunter'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Anomaly Hunter</span>
        </button>
        <button
          onClick={() => handleTabChange('bargains')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeModule === 'bargains'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Invendus & Affaires</span>
        </button>
        <button
          onClick={() => handleTabChange('legit_check')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeModule === 'legit_check'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Vérif Authentique</span>
        </button>
        <button
          onClick={() => handleTabChange('trends')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeModule === 'trends'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Snipe du Mois</span>
        </button>
      </nav>

      {/* Right zone: Discord settings & status */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            sounds.playClick();
            onOpenSettings();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
          title="Configurer les 3 Webhooks Discord"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Webhooks Discord</span>
          <span className="text-[10px] font-mono bg-indigo-500/20 px-1.5 py-0.2 rounded text-indigo-300">
            3
          </span>
        </button>

        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs">
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Dark Mode Pro</span>
        </div>
      </div>
    </header>
  );
};
