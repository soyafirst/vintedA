import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Search, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  Send, 
  DollarSign, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  SlidersHorizontal,
  ArrowUpDown,
  ShoppingBag,
  Flame,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { BargainItem } from '../../types';
import { getDiscordConfig } from '../DiscordSettingsModal';
import { sounds } from '../../utils/audio';

const STORAGE_KEY_BARGAINS = 'omnitool_vinted_bargains_saved_v1';

const PRESET_SEARCHES = [
  {
    name: 'Carhartt & Workwear < 20€',
    url: 'https://www.vinted.fr/catalog?search_text=carhartt&price_to=20&order=relevance',
    maxPrice: 20,
  },
  {
    name: 'Ralph Lauren & Tommy < 15€',
    url: 'https://www.vinted.fr/catalog?search_text=ralph+lauren+tommy&price_to=15&order=relevance',
    maxPrice: 15,
  },
  {
    name: 'The North Face & Gorpcore < 30€',
    url: 'https://www.vinted.fr/catalog?search_text=north+face+salomon&price_to=30&order=relevance',
    maxPrice: 30,
  },
  {
    name: 'Stüssy & Supreme < 25€',
    url: 'https://www.vinted.fr/catalog?search_text=stussy+supreme&price_to=25&order=relevance',
    maxPrice: 25,
  },
  {
    name: 'Sneakers Nike & Jordan < 35€',
    url: 'https://www.vinted.fr/catalog?search_text=nike+dunk+jordan&price_to=35&order=relevance',
    maxPrice: 35,
  },
];

export const BargainHunter: React.FC = () => {
  const [catalogUrl, setCatalogUrl] = useState<string>('https://www.vinted.fr/catalog?search_text=carhartt&price_to=25&order=relevance');
  const [maxPrice, setMaxPrice] = useState<number>(25);
  const [minDaysUnsold, setMinDaysUnsold] = useState<number>(10);
  const [activeSellerOnly, setActiveSellerOnly] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'profit' | 'days' | 'price'>('profit');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [items, setItems] = useState<BargainItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BARGAINS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [sendingDiscord, setSendingDiscord] = useState<boolean>(false);
  const [selectedOfferItem, setSelectedOfferItem] = useState<BargainItem | null>(null);

  // Persist items
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BARGAINS, JSON.stringify(items));
    } catch {
      // storage error
    }
  }, [items]);

  const handleApplyPreset = (preset: typeof PRESET_SEARCHES[0]) => {
    sounds.playClick();
    setCatalogUrl(preset.url);
    setMaxPrice(preset.maxPrice);
  };

  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    sounds.playClick();
    setIsLoading(true);
    setStatusMessage('Connexion et analyse des pages profondes de Vinted...');
    setStatusType('info');

    try {
      const res = await fetch('/api/vinted/bargains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogUrl: catalogUrl.trim(),
          maxPrice,
          minDaysUnsold,
          activeSellerOnly,
          catalogName: 'Recherche Invendus & Bonnes Affaires',
        }),
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.items)) {
        if (data.items.length === 0) {
          setStatusMessage('Aucun article ne correspond strictement aux filtres combinés. Essaie d’élargir le prix max ou l’ancienneté.');
          setStatusType('info');
        } else {
          setItems(data.items);
          setStatusMessage(`🎯 ${data.items.length} pépites invendues identifiées avec succès !`);
          setStatusType('success');
          sounds.playSuccess();
        }
      } else {
        setStatusMessage(data.error || 'Erreur lors de la récupération des annonces');
        setStatusType('error');
      }
    } catch (err: any) {
      console.warn('Bargains error:', err);
      setStatusMessage('Erreur de connexion au serveur de scan');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyScript = (item: BargainItem) => {
    sounds.playClick();
    navigator.clipboard.writeText(item.negotiationScript);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const handleSendToDiscord = async (itemToSend?: BargainItem) => {
    const config = getDiscordConfig();
    const webhook = config.webhook1_hunter || localStorage.getItem('omnitool_vinted_discord_webhook_url');

    if (!webhook || !webhook.trim().startsWith('https://discord.com/api/webhooks/')) {
      alert('Veuillez configurer une URL de Webhook Discord valide dans les paramètres.');
      return;
    }

    setSendingDiscord(true);
    sounds.playClick();

    const targets = itemToSend ? [itemToSend] : items.slice(0, 5);

    try {
      for (const item of targets) {
        await fetch('/api/discord/send-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: webhook.trim(),
            customPayload: {
              username: 'Vinted Invendus & Bonnes Affaires',
              avatar_url: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=128&q=80',
              embeds: [
                {
                  title: `🏷️ Pépite Invendue : ${item.title}`,
                  url: item.itemUrl,
                  color: 0x10b981,
                  description: `**🕒 Invendu depuis ${item.daysUnsold} jours · Offre recommandée à -40% !**\n\n💬 *Proposition directe :* "${item.negotiationScript}"`,
                  fields: [
                    { name: '💰 Prix Actuel', value: `~~${item.sellerPrice} €~~`, inline: true },
                    { name: '🔥 Offre Max -40%', value: `**${item.offerPrice40} €**`, inline: true },
                    { name: '📈 Revente Estimée', value: `**${item.marketPrice} €**`, inline: true },
                    { name: '💵 Marge Nette Estimée', value: `**+${item.estimatedNetProfit} €**`, inline: true },
                    { name: '🏷️ Marque / Taille', value: `${item.brand} · ${item.size}`, inline: true },
                    { name: '🛒 Lien Annonce', value: `[Ouvrir l'annonce](${item.itemUrl})`, inline: true },
                  ],
                  thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
                  footer: { text: `OmniTool · Search Invendus & Bonnes Affaires` },
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          }),
        });
      }

      setStatusMessage(itemToSend ? 'Offre envoyée avec succès sur Discord !' : `${targets.length} pépites envoyées sur Discord !`);
      setStatusType('success');
      sounds.playSuccess();
    } catch (err: any) {
      console.warn('Discord send error:', err);
      setStatusMessage('Erreur lors de l’envoi Discord');
      setStatusType('error');
    } finally {
      setSendingDiscord(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'profit') return b.estimatedNetProfit - a.estimatedNetProfit;
    if (sortBy === 'days') return b.daysUnsold - a.daysUnsold;
    return a.offerPrice40 - b.offerPrice40;
  });

  const totalPotentialProfit = items.reduce((sum, item) => sum + item.estimatedNetProfit, 0);

  return (
    <div className="space-y-6">
      {/* 🌟 EN-TÊTE DU MODULE */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DEEP SEARCH & NÉGOCIATION MAX -40%</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Invendus & Bonnes Affaires</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                PRO
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Débusque les annonces oubliées depuis des semaines sur Vinted, filtre les vendeurs actifs, et propose immédiatement l'offre agressive à -40% pour maximiser votre marge à la revente.
            </p>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-white/5 shrink-0">
            <div>
              <div className="text-xs text-slate-400 font-medium">Gain Net Potentiel</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                +{totalPotentialProfit} €
              </div>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div>
              <div className="text-xs text-slate-400 font-medium">Pièces Trouvées</div>
              <div className="text-2xl font-black text-white font-mono">
                {items.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎛️ SECTION 1 : FORMULAIRE DE RECHERCHE AVANCÉE */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 space-y-6 shadow-xl">
        <form onSubmit={handleRunSearch} className="space-y-5">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Colle ici l'URL de ton catalogue Vinted</span>
              </span>
              <span className="text-[11px] text-slate-500 lowercase">
                ex: https://www.vinted.fr/catalog?search_text=carhartt...
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="https://www.vinted.fr/catalog?search_text=..."
                className="w-full px-4 py-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono pr-28 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setCatalogUrl('https://www.vinted.fr/catalog?search_text=carhartt&price_to=25&order=relevance')}
                className="absolute right-2 top-2 bottom-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Reset URL
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Suggestions de niches rentables :
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_SEARCHES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Tag className="w-3 h-3 text-emerald-400" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-slate-800/80">
            {/* 1. FILTRE PRIX BAS */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Prix max d'achat</span>
                <span className="text-emerald-400 font-mono font-bold">{maxPrice} €</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-center text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Ne retient que les pièces sous ce plafond budgétaire.
              </p>
            </div>

            {/* 2. FILTRE ANCIENNETÉ (INVENDUS) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ancienneté (Invendus)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Tout', days: 0 },
                  { label: '+ 10 jours', days: 10 },
                  { label: '+ 20 jours', days: 20 },
                  { label: '+ 30 jours', days: 30 },
                ].map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setMinDaysUnsold(option.days);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      minDaysUnsold === option.days
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Cible les vendeurs lassés prêts à brader leur article.
              </p>
            </div>

            {/* 3. COCHE VENDEUR ACTIF */}
            <div className="space-y-3 flex flex-col justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fiabilité Vendeur</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={activeSellerOnly}
                  onChange={(e) => setActiveSellerOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-slate-200">Vendeur actif récemment</div>
                  <div className="text-[11px] text-slate-400">Élimine les comptes fantômes et inactifs</div>
                </div>
              </label>

              <p className="text-[11px] text-slate-500">
                Garantit une réponse et une expédition rapide.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span>Deep Search parcourt le catalogue jusqu'aux offres oubliées.</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                isLoading
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 hover:scale-[1.01]'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Analyse des pépites oubliées...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" />
                  <span>🚀 Scanner les pépites oubliées</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Status banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              statusType === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : statusType === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-300'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusType === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusType === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => handleSendToDiscord()}
                disabled={sendingDiscord}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{sendingDiscord ? 'Envoi...' : 'Envoyer tout sur Discord'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 📦 SECTION 2 : RÉSULTATS DE RECHERCHE (CARTES D'OPPORTUNITÉ) */}
      <div className="space-y-4">
        {/* Results Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <span>Pépites Identifiées ({sortedItems.length})</span>
            {sortedItems.length > 0 && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Marge cumulée : +{totalPotentialProfit} €
              </span>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Trier par :</span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSortBy('profit')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    sortBy === 'profit' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Max Profit
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('days')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    sortBy === 'days' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Ancien
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('price')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    sortBy === 'price' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Prix bas
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSendToDiscord()}
                disabled={sendingDiscord}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Discord</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {sortedItems.length === 0 && !isLoading && (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Aucun invendu scanné pour le moment</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Sélectionne un preset ou colle l'URL de ta recherche Vinted pour révéler les pièces oubliées et générer tes offres à -40%.
            </p>
            <button
              type="button"
              onClick={() => handleRunSearch()}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Lancer un premier scan
            </button>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group"
            >
              <div>
                {/* Photo Header */}
                <div className="relative h-48 bg-slate-950 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-3xl">
                      🛍️
                    </div>
                  )}

                  {/* Days Unsold Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 text-slate-200 text-[11px] font-mono font-medium flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Invendu depuis {item.daysUnsold} jours</span>
                  </div>

                  {/* Potential Profit Badge */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500/90 backdrop-blur-md text-slate-950 text-[11px] font-mono font-black flex items-center gap-1 shadow-lg">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{item.estimatedNetProfit} € net</span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-semibold text-emerald-400">{item.brand}</span>
                      <span className="font-mono">Taille : {item.size}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">État : {item.condition}</p>
                  </div>

                  {/* Financial Metrics Box */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Prix Direct</div>
                      <div className="text-sm font-mono text-slate-300 line-through">
                        {item.sellerPrice} €
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-400 uppercase font-bold">Offre -40%</div>
                      <div className="text-base font-mono font-black text-emerald-400">
                        {item.offerPrice40} €
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Cote Revente</div>
                      <div className="text-sm font-mono font-bold text-white">
                        {item.marketPrice} €
                      </div>
                    </div>
                  </div>

                  {/* Pre-formatted negotiation script preview */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 space-y-1.5">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase flex items-center justify-between">
                      <span>Message d'offre poli pré-rempli :</span>
                      <button
                        type="button"
                        onClick={() => handleCopyScript(item)}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px] cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copié !</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 italic line-clamp-2 leading-relaxed">
                      "{item.negotiationScript}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 pt-0 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Button 1 : Acheter Direct */}
                  <a
                    href={item.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>⚡ Direct {item.sellerPrice}€</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Button 2 : Faire l'Offre */}
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyScript(item);
                      setSelectedOfferItem(item);
                      sounds.playSuccess();
                    }}
                    className="px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-500/20"
                  >
                    <Copy className="w-3 h-3" />
                    <span>💬 Offre {item.offerPrice40}€</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-500">ID #{item.id}</span>
                  <button
                    type="button"
                    onClick={() => handleSendToDiscord(item)}
                    disabled={sendingDiscord}
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Partager sur Discord</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 💬 MODAL DE NÉGOCIATION RAPIDE */}
      {selectedOfferItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Tag className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-white">Prêt pour l'offre Vinted !</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOfferItem(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Le message poli a été <strong className="text-emerald-400">copié dans votre presse-papier</strong>. Il ne vous reste plus qu'à cliquer sur « Ouvrir sur Vinted » et le coller dans la messagerie du vendeur !
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">Texte copié :</div>
              <div className="text-xs text-slate-200 font-mono bg-slate-900 p-2.5 rounded-lg border border-white/5">
                {selectedOfferItem.negotiationScript}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedOfferItem.negotiationScript);
                  sounds.playClick();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Re-copier</span>
              </button>

              <a
                href={selectedOfferItem.itemUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSelectedOfferItem(null)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <span>Ouvrir sur Vinted</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
