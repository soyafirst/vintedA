/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppModule } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { VintedHunter } from './components/modules/VintedHunter';
import { BargainHunter } from './components/modules/BargainHunter';
import { LegitCheck } from './components/modules/LegitCheck';
import { SnipeTrends } from './components/modules/SnipeTrends';
import { DiscordSettingsModal } from './components/DiscordSettingsModal';

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>('hunter');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col antialiased selection:bg-amber-600 selection:text-white">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Workspace Area on the right */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Top Header */}
        <Header
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeModule === 'hunter' && (
            <section className="animate-fade-in" aria-label="Anomaly Hunter">
              <VintedHunter />
            </section>
          )}

          {activeModule === 'bargains' && (
            <section className="animate-fade-in" aria-label="Invendus & Bonnes Affaires">
              <BargainHunter />
            </section>
          )}

          {activeModule === 'legit_check' && (
            <section className="animate-fade-in" aria-label="Vérif Authentique">
              <LegitCheck />
            </section>
          )}

          {activeModule === 'trends' && (
            <section className="animate-fade-in" aria-label="Snipe du Mois">
              <SnipeTrends />
            </section>
          )}
        </main>
      </div>

      {/* Global 3 Discord Webhooks Settings Modal */}
      <DiscordSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
