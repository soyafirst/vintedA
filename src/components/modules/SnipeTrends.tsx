import React, { useState } from 'react';
import { 
  TrendingUp, 
  Flame, 
  AlertTriangle, 
  Send, 
  Search, 
  Clock, 
  Heart, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { SnipeTrendModel } from '../../types';
import { sounds } from '../../utils/audio';

const SNIPE_MODELS: SnipeTrendModel[] = [
  {
    id: 'sn_01',
    brand: "Arc'teryx",
    name: 'Veste Alpha SV / Beta LT Gore-Tex',
    category: 'Gorpcore',
    medianPrice: 195,
    priceRange: { min: 140, max: 260 },
    targetBuyPrice: 80,
    avgLikesPerDay: 58,
    sellingSpeed: '< 24h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 115,
    seasonality: 'Automne / Hiver (Peak)',
  },
  {
    id: 'sn_02',
    brand: 'C.P. Company',
    name: 'D.D. Shell Goggle Jacket',
    category: 'Streetwear',
    medianPrice: 165,
    priceRange: { min: 125, max: 210 },
    targetBuyPrice: 70,
    avgLikesPerDay: 42,
    sellingSpeed: '< 48h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 95,
    seasonality: 'Toute l’année',
  },
  {
    id: 'sn_03',
    brand: 'UGG',
    name: 'Mules Tasman & Tazz Plateau Châtaigne',
    category: 'Casual Chic',
    medianPrice: 110,
    priceRange: { min: 90, max: 135 },
    targetBuyPrice: 45,
    avgLikesPerDay: 75,
    sellingSpeed: '< 12h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 65,
    seasonality: 'Hiver (Forte demande)',
  },
  {
    id: 'sn_04',
    brand: 'Nike',
    name: 'Dunk Low Retro Panda Black & White',
    category: 'Sneakers',
    medianPrice: 65,
    priceRange: { min: 50, max: 85 },
    targetBuyPrice: 25,
    avgLikesPerDay: 62,
    sellingSpeed: '< 24h',
    highRiskReplica: true,
    trendDirection: 'stable',
    estimatedMargin: 40,
    seasonality: 'Permanent',
  },
  {
    id: 'sn_05',
    brand: 'Carhartt WIP',
    name: 'Detroit Jacket Veste en Toile Duck Canvas',
    category: 'Streetwear',
    medianPrice: 130,
    priceRange: { min: 95, max: 180 },
    targetBuyPrice: 50,
    avgLikesPerDay: 51,
    sellingSpeed: '< 36h',
    highRiskReplica: false,
    trendDirection: 'hot',
    estimatedMargin: 80,
    seasonality: 'Mi-saison',
  },
  {
    id: 'sn_06',
    brand: 'Ralph Lauren',
    name: 'Pull Câblé Col Rond Maille Torsadée',
    category: 'Casual Chic',
    medianPrice: 55,
    priceRange: { min: 40, max: 75 },
    targetBuyPrice: 20,
    avgLikesPerDay: 38,
    sellingSpeed: '< 48h',
    highRiskReplica: false,
    trendDirection: 'up',
    estimatedMargin: 35,
    seasonality: 'Automne / Hiver',
  },
  {
    id: 'sn_07',
    brand: 'Salomon',
    name: 'XT-6 Gore-Tex & ACS Pro Advanced',
    category: 'Sneakers',
    medianPrice: 120,
    priceRange: { min: 95, max: 150 },
    targetBuyPrice: 50,
    avgLikesPerDay: 49,
    sellingSpeed: '< 24h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 70,
    seasonality: 'Permanent',
  },
  {
    id: 'sn_08',
    brand: 'Corteiz',
    name: 'Guerillaz Cargo Pants Black / Red',
    category: 'Streetwear',
    medianPrice: 105,
    priceRange: { min: 80, max: 140 },
    targetBuyPrice: 40,
    avgLikesPerDay: 66,
    sellingSpeed: '< 18h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 65,
    seasonality: 'Toute l’année',
  },
  {
    id: 'sn_09',
    brand: 'Stone Island',
    name: 'Sweat Basique Crewneck avec Badge Boussole',
    category: 'Streetwear',
    medianPrice: 140,
    priceRange: { min: 110, max: 175 },
    targetBuyPrice: 60,
    avgLikesPerDay: 44,
    sellingSpeed: '< 48h',
    highRiskReplica: true,
    trendDirection: 'stable',
    estimatedMargin: 80,
    seasonality: 'Mi-saison / Hiver',
  },
  {
    id: 'sn_10',
    brand: 'Stüssy',
    name: '8-Ball Mohair Knitted Sweater',
    category: 'Streetwear',
    medianPrice: 125,
    priceRange: { min: 90, max: 160 },
    targetBuyPrice: 45,
    avgLikesPerDay: 54,
    sellingSpeed: '< 24h',
    highRiskReplica: true,
    trendDirection: 'hot',
    estimatedMargin: 80,
    seasonality: 'Hiver',
  },
];

export const SnipeTrends: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [discordSending, setDiscordSending] = useState<boolean>(false);
  const [discordFeedback, setDiscordFeedback] = useState<string | null>(null);

  const categories = ['all', 'Streetwear', 'Gorpcore', 'Sneakers', 'Casual Chic'];

  const filteredModels = SNIPE_MODELS.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handlePublishToDiscord = async () => {
    let webhook3 = '';
    try {
      const stored = localStorage.getItem('omnitool_discord_webhooks_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        webhook3 = parsed.webhook3_trends || '';
      }
    } catch {
      //
    }

    if (!webhook3 || !webhook3.trim().startsWith('https://discord.com/api/webhooks/')) {
      setDiscordFeedback('⚠️ Veuillez configurer le Webhook 3 (Snipe du Mois) dans les Paramètres ⚙️.');
      return;
    }

    setDiscordSending(true);
    setDiscordFeedback(null);
    sounds.playClick();

    const topItems = SNIPE_MODELS.slice(0, 5)
      .map(
        (m, idx) =>
          `**${idx + 1}. ${m.brand} - ${m.name}**\n` +
          `💰 **Prix Médian :** ${m.medianPrice}€ (${m.priceRange.min}€-${m.priceRange.max}€) | Cible achat : **≤ ${m.targetBuyPrice}€**\n` +
          `⚡ **Liquidité :** ${m.avgLikesPerDay} likes/j (${m.sellingSpeed}) ${m.highRiskReplica ? '· ⚠️ *Fort risque réplique*' : ''}\n`
      )
      .join('\n');

    const payload = {
      username: 'Vinted Trends & Liquidité',
      avatar_url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=128&q=80',
      embeds: [
        {
          title: '📈 Classement : Top Snipes & Pièces Ultra-Liquides sur Vinted',
          color: 0x8b5cf6, // purple
          description:
            '**Voici les modèles les plus demandés avec le délai de revente le plus rapide ce mois-ci :**\n\n' +
            topItems,
          fields: [
            {
              name: '🎯 Recommandation Achat/Revente',
              value: 'Privilégier les pièces à plus de 45 likes/jour avec un prix d’achat inférieur ou égal au prix cible conseillé pour garantir une rotation de stock sous 48h.',
              inline: false,
            },
          ],
          footer: {
            text: 'OmniTool · Snipe du Mois & Top Liquidité',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhook3.trim(),
          customPayload: payload,
        }),
      });

      if (res.ok) {
        setDiscordFeedback('✅ Rapport de tendances publié sur Discord avec succès !');
        sounds.playSuccess();
      } else {
        const errJson = await res.json();
        setDiscordFeedback(`❌ Erreur Discord : ${errJson.error || 'Vérifiez le Webhook 3'}`);
      }
    } catch (err: any) {
      setDiscordFeedback(`❌ Erreur : ${err.message}`);
    } finally {
      setDiscordSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-5 h-5" />
            </span>
            Snipe du Mois & Top Liquidité
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Classement algorithmique des modèles les plus recherchés sur Vinted, délais moyens de vente et prix cibles d'achat pour maximiser le ROI.
          </p>
        </div>

        {/* Publish to Discord button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePublishToDiscord}
            disabled={discordSending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-purple-600/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span>📢 Publier le rapport sur Discord (Webhook 3)</span>
          </button>
        </div>
      </div>

      {discordFeedback && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 text-center animate-fade-in">
          {discordFeedback}
        </div>
      )}

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Rotation de Stock Médiane</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </span>
          <div className="text-2xl font-bold font-mono text-white tabular-nums pt-1">
            &lt; 36 Heures
          </div>
          <p className="text-[11px] text-slate-400">
            Délai moyen d'écoulement pour les pièces du top 10
          </p>
        </div>

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Marge Brute Moyenne</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums pt-1">
            +72.50 €
          </div>
          <p className="text-[11px] text-slate-400">
            Gain net estimé par vente au prix cible
          </p>
        </div>

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Modèles à Fort Risque Replica</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </span>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums pt-1">
            7 / 10 Modèles
          </div>
          <p className="text-[11px] text-slate-400">
            Legit Check photo fortement recommandé avant achat
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-800/70">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                sounds.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Toutes les catégories' : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un modèle ou une marque..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-hidden focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Top Models Table / Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModels.map((item, idx) => (
            <div
              key={item.id}
              className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Header: Rank + Brand + Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-purple-400">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {item.brand}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {item.category}
                    </span>
                  </div>

                  {item.highRiskReplica && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <AlertTriangle className="w-3 h-3" />
                      ⚠️ Risque élevé de contrefaçon
                    </span>
                  )}
                </div>

                {/* Model Title */}
                <h3 className="text-sm font-bold text-white leading-snug">
                  {item.name}
                </h3>

                {/* Pricing & Target Grid */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-center mt-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Prix Médian</span>
                    <span className="font-mono font-bold text-white text-sm">{item.medianPrice} €</span>
                    <span className="text-[10px] text-slate-500 block">({item.priceRange.min}-{item.priceRange.max}€)</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Cible Achat Max</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">≤ {item.targetBuyPrice} €</span>
                    <span className="text-[10px] text-emerald-500/80 block">Rentabilité max</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-purple-400 uppercase tracking-wider block">Marge Estimée</span>
                    <span className="font-mono font-bold text-purple-300 text-sm">+{item.estimatedMargin} €</span>
                    <span className="text-[10px] text-purple-400/80 block">ROI brut</span>
                  </div>
                </div>
              </div>

              {/* Liquidity Indicator Footer */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-mono text-rose-400">
                    <Heart className="w-3.5 h-3.5 fill-rose-500/30 text-rose-400" />
                    <strong>{item.avgLikesPerDay}</strong> likes / jour
                  </span>

                  <span aria-hidden="true" className="text-slate-700">·</span>

                  <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Vente {item.sellingSpeed}
                  </span>
                </div>

                <a
                  href={`https://www.vinted.fr/catalog?search_text=${encodeURIComponent(item.brand + ' ' + item.name)}&order=newest_first`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>Chercher sur Vinted</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
