import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, 
  Search, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  TrendingDown, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Clock, 
  X, 
  Radio, 
  ShoppingBag, 
  Info, 
  Settings, 
  Send, 
  BellRing, 
  ArrowDownRight, 
  Share2, 
  SlidersHorizontal, 
  Plus, 
  RotateCcw, 
  Check, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  FolderPlus, 
  Trash2, 
  Layers, 
  Target, 
  ListFilter 
} from 'lucide-react';
import { VintedAlert, VintedCatalog } from '../../types';
import { sounds } from '../../utils/audio';
import { getDiscordConfig, saveDiscordConfig } from '../DiscordSettingsModal';

const DISCORD_STORAGE_KEY = 'omnitool_vinted_discord_webhook_url';
const DISCORD_ENABLED_KEY = 'omnitool_vinted_discord_enabled';
const DISCORD_SENT_STORAGE_KEY = 'omnitool_vinted_sent_discord_ids_v1';
const FILTERS_STORAGE_KEY = 'omnitool_vinted_resell_filters_v1';
const CATALOGS_STORAGE_KEY = 'omnitool_vinted_catalogs_v1';

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
const SHOE_SIZES = ['40', '41', '42', '42.5', '43', '44', '45'] as const;

export type BrandPackKey = 'all' | 'streetwear' | 'gorpcore' | 'casual_chic' | 'sneakers';

export const BRAND_PACKS: Record<BrandPackKey, { label: string; tag: string; brands: string[] }> = {
  all: {
    label: 'Toutes les marques',
    tag: 'Toutes',
    brands: [],
  },
  streetwear: {
    label: 'Pack Streetwear',
    tag: 'Carhartt, Stüssy, Corteiz, Supreme, Trapstar',
    brands: ['carhartt', 'stüssy', 'stussy', 'corteiz', 'supreme', 'trapstar', 'bape', 'palace'],
  },
  gorpcore: {
    label: 'Pack Gorpcore / Outdoor',
    tag: "Arc'teryx, Salomon, The North Face, Patagonia",
    brands: ["arc'teryx", 'arcteryx', 'arc teryx', 'salomon', 'the north face', 'north face', 'patagonia', 'mammut', 'oakley'],
  },
  casual_chic: {
    label: 'Pack Casual Chic',
    tag: 'Ralph Lauren, Lacoste, Tommy Hilfiger',
    brands: ['ralph lauren', 'polo', 'lacoste', 'tommy hilfiger', 'tommy', 'hugo boss', 'barbour'],
  },
  sneakers: {
    label: 'Sneakers Hypées',
    tag: 'Nike Dunk, Jordan, adidas Gazelle, Onitsuka',
    brands: ['nike dunk', 'dunk', 'jordan', 'air jordan', 'gazelle', 'samba', 'campus', 'onitsuka tiger', 'asics', 'new balance'],
  },
};

interface ResellFilters {
  sizes: string[];
  maxPriceEnabled: boolean;
  maxPrice: number;
  brandPack: BrandPackKey;
  customBrands: string[];
}

const DEFAULT_FILTERS: ResellFilters = {
  sizes: [],
  maxPriceEnabled: true,
  maxPrice: 50,
  brandPack: 'all',
  customBrands: [],
};

const DEFAULT_CATALOGS: VintedCatalog[] = [
  {
    id: 'cat_ralph_carhartt',
    name: 'Ralph Lauren & Carhartt < 35€',
    url: 'https://www.vinted.fr/catalog?search_text=ralph+lauren+carhartt&price_to=35',
    enabled: true,
    articlesFoundCount: 4,
    createdAt: Date.now() - 1000 * 3600 * 24,
  },
  {
    id: 'cat_arcteryx_salomon',
    name: 'Arc’teryx & Salomon Techwear',
    url: 'https://www.vinted.fr/catalog?search_text=arcteryx+salomon&price_to=65',
    enabled: true,
    articlesFoundCount: 2,
    createdAt: Date.now() - 1000 * 3600 * 12,
  },
];

export const VintedHunter: React.FC = () => {
  const [isBotListening, setIsBotListening] = useState<boolean>(true);
  const [analyzedCount, setAnalyzedCount] = useState<number>(0);
  const [anomaliesCount, setAnomaliesCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<VintedAlert[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'certified' | 'manual' | 'price_drop'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedDeal, setSelectedDeal] = useState<VintedAlert | null>(null);

  // Advanced Reselling Filter State
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<ResellFilters>(() => {
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [newCustomBrandInput, setNewCustomBrandInput] = useState<string>('');

  // Multi-Catalog State
  const [catalogsOpen, setCatalogsOpen] = useState<boolean>(true);
  const [catalogs, setCatalogs] = useState<VintedCatalog[]>(() => {
    try {
      const stored = localStorage.getItem(CATALOGS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_CATALOGS;
    } catch {
      return DEFAULT_CATALOGS;
    }
  });
  const [newCatalogName, setNewCatalogName] = useState<string>('');
  const [newCatalogUrl, setNewCatalogUrl] = useState<string>('');
  const [newCatalogWebhook, setNewCatalogWebhook] = useState<string>('');
  const [catalogWebhookEditingId, setCatalogWebhookEditingId] = useState<string | null>(null);
  const [editingWebhookValue, setEditingWebhookValue] = useState<string>('');
  const [catalogTestStatus, setCatalogTestStatus] = useState<Record<string, { status: 'idle' | 'sending' | 'success' | 'error'; message: string }>>({});
  const [activeCatalogScanning, setActiveCatalogScanning] = useState<string>('Catalogue Général');
  const catalogRotationIndexRef = useRef<number>(0);
  const sentDiscordIdsRef = useRef<Set<string>>((() => {
    try {
      const stored = localStorage.getItem(DISCORD_SENT_STORAGE_KEY);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  })());

  // Discord Webhook configuration
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>(() => {
    return getDiscordConfig().webhook1_hunter;
  });
  const [discordAutoSend, setDiscordAutoSend] = useState<boolean>(() => {
    return getDiscordConfig().autoSendHunter;
  });

  useEffect(() => {
    const handleSync = () => {
      const cfg = getDiscordConfig();
      setDiscordWebhookUrl(cfg.webhook1_hunter);
      setDiscordAutoSend(cfg.autoSendHunter);
    };
    window.addEventListener('discord-config-updated', handleSync);
    return () => window.removeEventListener('discord-config-updated', handleSync);
  }, []);

  const [discordTestStatus, setDiscordTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [discordTestMessage, setDiscordTestMessage] = useState<string>('');

  // Scanning polling status
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [serverStatusMessage, setServerStatusMessage] = useState<string>('Initialisation du flux multi-catalogues...');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Persist catalogs to localStorage & sync to autonomous background server worker
  useEffect(() => {
    try {
      localStorage.setItem(CATALOGS_STORAGE_KEY, JSON.stringify(catalogs));
      fetch('/api/vinted/sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogs,
          discordWebhookUrl: discordWebhookUrl.trim(),
        }),
      }).catch(() => {});
    } catch {
      // storage error
    }
  }, [catalogs, discordWebhookUrl]);

  // Persist filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // storage error
    }
  }, [filters]);

  // Strict check if an item complies with 100% of the active criteria
  const checkMatchesCriteria = (item: VintedAlert, currentFilters: ResellFilters): boolean => {
    // 1. Max price budget check
    if (currentFilters.maxPriceEnabled && item.sellerPrice > currentFilters.maxPrice) {
      return false;
    }

    // 2. Size check
    if (currentFilters.sizes.length > 0) {
      const itemSizeNorm = (item.size || '').toLowerCase().replace(',', '.').replace(/\s+/g, '');
      const titleNorm = (item.title || '').toLowerCase().replace(',', '.');

      const sizeMatches = currentFilters.sizes.some((targetSize) => {
        const targetNorm = targetSize.toLowerCase().replace(',', '.').replace(/\s+/g, '');
        if (itemSizeNorm.includes(targetNorm)) return true;
        if (titleNorm.includes(`taille ${targetNorm}`) || titleNorm.includes(`t.${targetNorm}`) || titleNorm.includes(`size ${targetNorm}`)) {
          return true;
        }
        if (['40', '41', '42', '42.5', '43', '44', '45'].includes(targetSize)) {
          const numRegex = new RegExp(`\\b${targetNorm.replace('.', '[,.]')}\\b`);
          if (numRegex.test(itemSizeNorm) || numRegex.test(titleNorm)) return true;
        }
        return false;
      });

      if (!sizeMatches) return false;
    }

    // 3. Brands check
    const hasPackFilter = currentFilters.brandPack !== 'all';
    const hasCustomBrands = currentFilters.customBrands.length > 0;

    if (hasPackFilter || hasCustomBrands) {
      let allowedKeywords: string[] = [];
      if (hasPackFilter) {
        allowedKeywords = [...BRAND_PACKS[currentFilters.brandPack].brands];
      }
      if (hasCustomBrands) {
        allowedKeywords = [...allowedKeywords, ...currentFilters.customBrands.map((b) => b.toLowerCase().trim())];
      }

      if (allowedKeywords.length > 0) {
        const fullItemText = `${item.brand} ${item.title}`.toLowerCase();
        const brandMatches = allowedKeywords.some((keyword) => fullItemText.includes(keyword));
        if (!brandMatches) return false;
      }
    }

    return true;
  };

  // Dispatch alert to Discord Webhook via backend proxy with strict deduplication
  const sendToDiscord = async (alert: VintedAlert, urlToUse?: string, forceManual = false) => {
    const webhook = urlToUse || discordWebhookUrl;
    if (!webhook || !webhook.trim().startsWith('https://discord.com/api/webhooks/')) return;

    const strId = String(alert.id);

    // Strict deduplication: NEVER send the same item twice automatically
    if (!forceManual) {
      if (sentDiscordIdsRef.current.has(strId)) {
        return;
      }
      sentDiscordIdsRef.current.add(strId);
      try {
        localStorage.setItem(
          DISCORD_SENT_STORAGE_KEY,
          JSON.stringify(Array.from(sentDiscordIdsRef.current).slice(-400))
        );
      } catch {
        // storage quota fallback
      }
    }

    try {
      await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhook.trim(),
          alert,
        }),
      });
    } catch (err) {
      console.warn('Discord send error:', err);
    }
  };

  // Perform backend scan cycle rotating through active catalogs
  const runScanCycle = async () => {
    if (isPolling) return;
    setIsPolling(true);

    // Determine target catalog for this rotation step
    const enabledCatalogs = catalogs.filter((c) => c.enabled);
    let targetCatalog: VintedCatalog | null = null;

    if (enabledCatalogs.length > 0) {
      const idx = catalogRotationIndexRef.current % enabledCatalogs.length;
      targetCatalog = enabledCatalogs[idx];
      catalogRotationIndexRef.current = (idx + 1) % enabledCatalogs.length;
    }

    const currentCatalogName = targetCatalog ? targetCatalog.name : 'Catalogue Général';
    const currentCatalogUrl = targetCatalog ? targetCatalog.url : 'https://www.vinted.fr/catalog?order=newest_first';
    const currentCatalogId = targetCatalog ? targetCatalog.id : 'default';

    setActiveCatalogScanning(currentCatalogName);

    try {
      const res = await fetch('/api/vinted/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogUrl: currentCatalogUrl,
          catalogName: currentCatalogName,
          catalogId: currentCatalogId,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // If backend reports Vinted inaccessible, do NOT generate fake items
        if (data.success === false) {
          setIsConnected(false);
          setServerStatusMessage(data.error || 'Vinted temporairement inaccessible');
          return;
        }

        setAnalyzedCount(data.totalAnalyzed || 0);
        setLastScanTime(new Date());
        setIsConnected(data.isConnected);
        setServerStatusMessage(data.statusMessage || (data.isConnected ? `Scan actif : ${currentCatalogName}` : 'En attente du flux...'));

        if (data.detectedAnomalies && data.detectedAnomalies.length > 0) {
          const rawItems: VintedAlert[] = data.detectedAnomalies.map((item: any) => ({
            ...item,
            itemUrl: `https://www.vinted.fr/items/${item.id}`,
            detectedAt: new Date(item.detectedAt || Date.now()),
            catalogName: currentCatalogName,
            catalogId: currentCatalogId,
          }));

          // Strict criteria filtering
          const qualifiedItems = rawItems.filter((item) => checkMatchesCriteria(item, filters));

          if (qualifiedItems.length > 0) {
            setAlerts((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const fresh = qualifiedItems.filter((item) => !existingIds.has(item.id));
              if (fresh.length > 0) {
                setAnomaliesCount((c) => c + fresh.length);

                // Increment articles found on the target catalog
                if (targetCatalog) {
                  setCatalogs((prevCats) =>
                    prevCats.map((cat) =>
                      cat.id === targetCatalog!.id
                        ? { ...cat, articlesFoundCount: cat.articlesFoundCount + fresh.length, lastScannedAt: Date.now() }
                        : cat
                    )
                  );
                }

                if (soundEnabled) {
                  sounds.playAnomalyAlert();
                }

                // Send to Discord: prioritize dedicated catalog webhook, fallback to global Webhook 1
                const catalogDedicatedWebhook = targetCatalog?.discordWebhookUrl?.trim();
                const globalWebhook = discordWebhookUrl.trim();
                const activeWebhook = catalogDedicatedWebhook || (discordAutoSend && globalWebhook ? globalWebhook : undefined);

                if (activeWebhook) {
                  for (const qualifiedItem of fresh) {
                    sendToDiscord(qualifiedItem, activeWebhook);
                  }
                }
              }
              return [...fresh, ...prev].slice(0, 60);
            });
          }
        }
      }
    } catch (err) {
      console.warn('Backend scan cycle error:', err);
      setServerStatusMessage('En attente du flux Vinted...');
    } finally {
      setIsPolling(false);
    }
  };

  // Automatic Polling: alternates between active catalogs every 3.5 seconds
  useEffect(() => {
    if (!isBotListening) return;

    runScanCycle();
    const interval = setInterval(() => {
      runScanCycle();
    }, 3500);

    return () => clearInterval(interval);
  }, [isBotListening, catalogs, filters, discordAutoSend, discordWebhookUrl, soundEnabled]);

  const handleToggleBot = () => {
    const nextState = !isBotListening;
    setIsBotListening(nextState);
    sounds.playClick();
  };

  const handleOpenDeal = (deal: VintedAlert) => {
    setSelectedDeal(deal);
    sounds.playClick();
  };

  const handleBuyDirect = (alert: VintedAlert) => {
    const canonicalUrl = `https://www.vinted.fr/items/${alert.id}`;
    sounds.playSuccess();
    window.open(canonicalUrl, '_blank', 'noopener,noreferrer');
  };

  // Catalog Management Handlers
  const handleAddCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatalogName.trim() || !newCatalogUrl.trim()) return;

    const newCat: VintedCatalog = {
      id: `cat_${Date.now()}`,
      name: newCatalogName.trim(),
      url: newCatalogUrl.trim(),
      enabled: true,
      articlesFoundCount: 0,
      createdAt: Date.now(),
      discordWebhookUrl: newCatalogWebhook.trim() || undefined,
    };

    setCatalogs((prev) => [newCat, ...prev]);
    setNewCatalogName('');
    setNewCatalogUrl('');
    setNewCatalogWebhook('');
    sounds.playSuccess();
  };

  const handleToggleCatalog = (id: string) => {
    sounds.playClick();
    setCatalogs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleDeleteCatalog = (id: string) => {
    sounds.playClick();
    setCatalogs((prev) => prev.filter((c) => c.id !== id));
    if (catalogWebhookEditingId === id) {
      setCatalogWebhookEditingId(null);
    }
  };

  const handleOpenEditWebhook = (cat: VintedCatalog) => {
    sounds.playClick();
    if (catalogWebhookEditingId === cat.id) {
      setCatalogWebhookEditingId(null);
    } else {
      setCatalogWebhookEditingId(cat.id);
      setEditingWebhookValue(cat.discordWebhookUrl || '');
    }
  };

  const handleSaveCatalogWebhook = (id: string) => {
    sounds.playSuccess();
    setCatalogs((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, discordWebhookUrl: editingWebhookValue.trim() || undefined } : c
      )
    );
    setCatalogWebhookEditingId(null);
  };

  const handleTestSingleCatalogWebhook = async (cat: VintedCatalog, webhookToTest?: string) => {
    const url = (webhookToTest !== undefined ? webhookToTest : (cat.discordWebhookUrl || discordWebhookUrl)).trim();
    if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
      setCatalogTestStatus((prev) => ({
        ...prev,
        [cat.id]: { status: 'error', message: 'URL invalide (doit débuter par https://discord.com/api/webhooks/)' },
      }));
      return;
    }

    setCatalogTestStatus((prev) => ({
      ...prev,
      [cat.id]: { status: 'sending', message: 'Envoi du test Discord en cours...' },
    }));
    sounds.playClick();

    const testAlert: VintedAlert = {
      id: alerts.length > 0 ? alerts[0].id : '109827110',
      title: `[TEST CATALOGUE] ${cat.name}`,
      brand: 'Vinted Radar',
      category: 'Mode & Streetwear',
      condition: 'Très bon état',
      sellerPrice: 18,
      previousPrice: 55,
      marketPrice: 55,
      discountPercentage: 67,
      sellerName: 'vendeur_test',
      sellerRating: 4.9,
      sellerReviewsCount: 34,
      isCertified: true,
      alertType: 'certified',
      detectedAt: new Date(),
      size: 'M',
      imageThumbnail: '⚡',
      imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80',
      itemUrl: `https://www.vinted.fr/catalog`,
      catalogName: cat.name,
      catalogId: cat.id,
      anomalyReason: `Test de transmission réussi ! Les opportunités détectées via le catalogue "${cat.name}" seront désormais envoyées sur ce salon Discord dédié.`,
    };

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url,
          alert: testAlert,
        }),
      });

      if (res.ok) {
        setCatalogTestStatus((prev) => ({
          ...prev,
          [cat.id]: { status: 'success', message: 'Embed Discord test envoyé avec succès sur ce salon !' },
        }));
        sounds.playSuccess();
      } else {
        const errData = await res.json();
        setCatalogTestStatus((prev) => ({
          ...prev,
          [cat.id]: { status: 'error', message: `Erreur Discord : ${errData.error || 'Vérifie les permissions'}` },
        }));
      }
    } catch (err: any) {
      setCatalogTestStatus((prev) => ({
        ...prev,
        [cat.id]: { status: 'error', message: `Erreur réseau : ${err.message}` },
      }));
    }
  };

  // Size toggle handlers
  const handleToggleSize = (size: string) => {
    sounds.playClick();
    setFilters((prev) => {
      const exists = prev.sizes.includes(size);
      const nextSizes = exists ? prev.sizes.filter((s) => s !== size) : [...prev.sizes, size];
      return { ...prev, sizes: nextSizes };
    });
  };

  const handleSelectAllSizes = () => {
    sounds.playClick();
    setFilters((prev) => ({ ...prev, sizes: [] }));
  };

  // Custom brand additions
  const handleAddCustomBrand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCustomBrandInput.trim();
    if (!trimmed) return;

    sounds.playClick();
    setFilters((prev) => {
      if (prev.customBrands.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, customBrands: [...prev.customBrands, trimmed] };
    });
    setNewCustomBrandInput('');
  };

  const handleRemoveCustomBrand = (brandToRemove: string) => {
    sounds.playClick();
    setFilters((prev) => ({
      ...prev,
      customBrands: prev.customBrands.filter((b) => b !== brandToRemove),
    }));
  };

  const handleResetFilters = () => {
    sounds.playClick();
    setFilters(DEFAULT_FILTERS);
  };

  const handleCleanAlerts = () => {
    sounds.playClick();
    setAlerts([]);
    setSelectedDeal(null);
  };

  const handleRemoveAlert = (idToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    setAlerts((prev) => prev.filter((a) => a.id !== idToRemove));
    if (selectedDeal?.id === idToRemove) {
      setSelectedDeal(null);
    }
  };

  const handleSaveDiscordSettings = () => {
    const currentCfg = getDiscordConfig();
    saveDiscordConfig({
      ...currentCfg,
      webhook1_hunter: discordWebhookUrl.trim(),
      autoSendHunter: discordAutoSend,
    });
    setShowWebhookModal(false);
    sounds.playSuccess();
  };

  const handleTestDiscordWebhook = async () => {
    if (!discordWebhookUrl.trim()) {
      setDiscordTestStatus('error');
      setDiscordTestMessage('Veuillez d’abord renseigner une URL de Webhook Discord valide.');
      return;
    }

    setDiscordTestStatus('sending');
    setDiscordTestMessage('Envoi du message test en cours...');
    sounds.playClick();

    const sampleId = alerts.length > 0 ? alerts[0].id : '10578451738';
    const sampleAlert: VintedAlert = {
      id: sampleId,
      title: 'TEST ANOMALIE MULTI-CATALOGUE : Veste Nuptse 700',
      brand: 'The North Face',
      category: 'Manteaux & Vestes',
      condition: 'Très bon état',
      sellerPrice: 22,
      previousPrice: 75,
      marketPrice: 75,
      discountPercentage: 71,
      sellerName: 'vendeur_verifie_fr',
      sellerRating: 4.9,
      sellerReviewsCount: 88,
      isCertified: true,
      alertType: 'price_drop',
      detectedAt: new Date(),
      size: filters.sizes[0] || 'L',
      imageThumbnail: '🧥',
      imageUrl: 'https://images1.vinted.net/t/04_0002f_zqGLsGvDthC9oDc9k2WR3FM2/310x430/27c3b3c9.webp',
      itemUrl: `https://www.vinted.fr/items/${sampleId}`,
      catalogName: activeCatalogScanning || 'Ralph Lauren & Carhartt < 35€',
      anomalyReason: `Test envoyé depuis OmniTool pour valider la ligne "Catalogue : ${activeCatalogScanning}".`,
    };

    try {
      const res = await fetch('/api/discord/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discordWebhookUrl.trim(),
          alert: sampleAlert,
        }),
      });

      if (res.ok) {
        setDiscordTestStatus('success');
        setDiscordTestMessage('Embed Discord envoyé avec succès ! Vérifie ton salon Discord.');
        sounds.playSuccess();
      } else {
        const errJson = await res.json();
        setDiscordTestStatus('error');
        setDiscordTestMessage(`Erreur Discord : ${errJson.error || 'Vérifie l’URL du webhook'}`);
      }
    } catch (err: any) {
      setDiscordTestStatus('error');
      setDiscordTestMessage(`Erreur de connexion : ${err.message}`);
    }
  };

  // Filtered displayed alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (!checkMatchesCriteria(alert, filters)) return false;

      if (filterType === 'certified' && alert.alertType !== 'certified') return false;
      if (filterType === 'manual' && alert.alertType !== 'manual') return false;
      if (filterType === 'price_drop' && alert.alertType !== 'price_drop') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          alert.title.toLowerCase().includes(q) ||
          alert.brand.toLowerCase().includes(q) ||
          alert.sellerName.toLowerCase().includes(q) ||
          (alert.catalogName && alert.catalogName.toLowerCase().includes(q)) ||
          alert.size.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [alerts, filters, filterType, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Module Title & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </span>
            Vinted Anomaly Hunter (Multi-Catalogues Ciblés)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Surveillance rotative en boucle de plusieurs recherches Vinted personnalisées avec détection des anomalies et alertes Discord étiquetées.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Discord Webhook Config Button */}
          <button
            onClick={() => {
              setShowWebhookModal(true);
              setDiscordTestStatus('idle');
              setDiscordTestMessage('');
              sounds.playClick();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              discordWebhookUrl
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>⚙️ Config Webhook Discord</span>
            {discordWebhookUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Sound toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              sounds.enabled = !soundEnabled;
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={soundEnabled ? 'Désactiver les alertes sonores' : 'Activer les alertes sonores'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Manual scan button */}
          <button
            onClick={() => {
              runScanCycle();
              sounds.playClick();
            }}
            disabled={isPolling}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isPolling ? 'animate-spin' : ''}`} />
            Scanner catalogue suivant
          </button>
        </div>
      </div>

      {/* Control Console: Bot Status Switch & 2 Statistical Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Switch Card */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Radar Multi-Catalogues
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isBotListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-sm font-semibold text-white">
                Statut : {isBotListening ? 'En écoute rotative' : 'En pause'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[210px] flex items-center gap-1">
              <span className="text-blue-400 font-mono font-medium">🎯 {activeCatalogScanning}</span>
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggleBot}
            role="switch"
            aria-checked={isBotListening}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              isBotListening ? 'bg-emerald-500' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isBotListening ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Counter 1: Articles analysés aujourd'hui */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Articles analysés aujourd'hui</span>
            <Radio className={`w-3.5 h-3.5 ${isBotListening ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`} />
          </span>
          <div className="text-3xl font-bold font-mono text-white tabular-nums tracking-tight pt-1">
            {analyzedCount.toLocaleString('fr-FR')}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>{lastScanTime ? `Dernier scan à ${lastScanTime.toLocaleTimeString('fr-FR')}` : 'En attente'}</span>
            <span aria-hidden="true">·</span>
            <span className={isConnected ? 'text-emerald-400' : 'text-slate-500'}>
              {isConnected ? 'API Connectée' : 'Connexion en cours'}
            </span>
          </p>
        </div>

        {/* Counter 2: Anomalies qualifiées */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pépites détectées</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="text-3xl font-bold font-mono text-amber-400 tabular-nums tracking-tight pt-1">
            {filteredAlerts.length}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
            <span>Catalogues actifs :</span>
            <span className="text-emerald-400 font-mono font-medium">
              {catalogs.filter((c) => c.enabled).length} / {catalogs.length}
            </span>
          </p>
        </div>
      </div>

      {/* 🎯 SECTION 1 : MES CATALOGUES & RECHERCHES CIBLÉES */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl transition-all">
        {/* Header toggle */}
        <div
          onClick={() => setCatalogsOpen(!catalogsOpen)}
          className="px-5 py-3.5 bg-slate-950/60 border-b border-white/5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-950/80 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Target className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Mes Catalogues & Recherches Ciblées ({catalogs.length})
            </span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
              (Rotation automatique toutes les 3.5s · {catalogs.filter((c) => c.enabled).length} actif(s))
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              {catalogsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </div>

        {catalogsOpen && (
          <div className="p-5 space-y-4 animate-fade-in text-xs">
            {/* Add catalog form */}
            <form onSubmit={handleAddCatalog} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
              <span className="font-semibold text-slate-200 block text-xs">
                Ajouter une nouvelle recherche Vinted à surveiller :
              </span>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <label className="text-[11px] text-slate-400 block mb-1">Nom du catalogue :</label>
                  <input
                    type="text"
                    required
                    value={newCatalogName}
                    onChange={(e) => setNewCatalogName(e.target.value)}
                    placeholder="Nom (ex: Ralph Lauren & Carhartt < 35€)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="text-[11px] text-slate-400 block mb-1">URL Vinted (filtres ou catalogue) :</label>
                  <input
                    type="url"
                    required
                    value={newCatalogUrl}
                    onChange={(e) => setNewCatalogUrl(e.target.value)}
                    placeholder="URL Vinted (ex: https://www.vinted.fr/catalog?...)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter le catalogue
                  </button>
                </div>
              </div>

              {/* Webhook Discord Dédié (Optionnel) */}
              <div className="pt-2 border-t border-slate-800/50">
                <label className="text-[11px] text-indigo-300 font-medium flex items-center gap-1.5 mb-1.5">
                  <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                  Webhook Discord Dédié à ce catalogue (Optionnel) :
                </label>
                <input
                  type="url"
                  value={newCatalogWebhook}
                  onChange={(e) => setNewCatalogWebhook(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/... (laisse vide pour utiliser le Webhook 1 général)"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  💡 <strong>Alerte ciblée :</strong> Les opportunités détectées sur ce catalogue partiront sur ce salon Discord spécifique.
                </span>
              </div>

              {/* Quick sample additions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                <span>Suggestions rapides :</span>
                {[
                  { name: 'Stüssy & Supreme < 45€', url: 'https://www.vinted.fr/catalog?search_text=stussy+supreme&price_to=45' },
                  { name: 'Nike Dunk & Jordan < 50€', url: 'https://www.vinted.fr/catalog?search_text=nike+dunk+jordan&price_to=50' },
                  { name: 'Lacoste & Tommy < 30€', url: 'https://www.vinted.fr/catalog?search_text=lacoste+tommy+hilfiger&price_to=30' },
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setNewCatalogName(sug.name);
                      setNewCatalogUrl(sug.url);
                      sounds.playClick();
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 transition-colors"
                  >
                    + {sug.name}
                  </button>
                ))}
              </div>
            </form>

            {/* Catalogs list */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
                Catalogues Enregistrés dans le Navigateur ({catalogs.length}) :
              </span>

              {catalogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-slate-500">
                  Aucun catalogue personnalisé enregistré. Le bot surveille actuellement le flux général de Vinted.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {catalogs.map((cat) => (
                    <div
                      key={cat.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        cat.enabled
                          ? activeCatalogScanning === cat.name && isPolling
                            ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                            : 'bg-slate-950/80 border-slate-800/90'
                          : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              cat.enabled ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white text-xs truncate">{cat.name}</span>
                              {activeCatalogScanning === cat.name && isPolling && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono animate-pulse">
                                  Scan en cours
                                </span>
                              )}
                              {/* Webhook badge */}
                              {cat.discordWebhookUrl ? (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-medium flex items-center gap-1">
                                  <BellRing className="w-2.5 h-2.5 text-indigo-400" />
                                  Webhook dédié actif
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 text-[10px]">
                                  Webhook général
                                </span>
                              )}
                            </div>
                            <a
                              href={cat.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-mono text-slate-500 hover:text-blue-400 truncate block transition-colors mt-0.5"
                            >
                              {cat.url}
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                          {/* Dedicated webhook toggle/edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditWebhook(cat)}
                            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                              cat.discordWebhookUrl
                                ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30 shadow-xs shadow-indigo-500/20'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
                            }`}
                            title="Configurer ou tester le Webhook Discord pour ce catalogue"
                          >
                            <BellRing className="w-3 h-3 text-indigo-400" />
                            <span>{cat.discordWebhookUrl ? 'Gérer Webhook' : '+ Webhook'}</span>
                          </button>

                          {/* Articles found counter badge */}
                          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>{cat.articlesFoundCount} trouvée(s)</span>
                          </div>

                          {/* ON/OFF toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleCatalog(cat.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              cat.enabled ? 'bg-emerald-600' : 'bg-slate-800'
                            }`}
                            title={cat.enabled ? 'Mettre en pause ce catalogue' : 'Activer la surveillance de ce catalogue'}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                                cat.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalog(cat.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                            title="Supprimer ce catalogue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Webhook Configuration Sub-panel for this catalog */}
                      {catalogWebhookEditingId === cat.id && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <BellRing className="w-3.5 h-3.5" />
                              </span>
                              <span className="font-semibold text-white text-xs">
                                Webhook Discord Dédié pour « {cat.name} » :
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCatalogWebhookEditingId(null)}
                              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-0.5"
                            >
                              Fermer ✕
                            </button>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="url"
                              value={editingWebhookValue}
                              onChange={(e) => setEditingWebhookValue(e.target.value)}
                              placeholder="https://discord.com/api/webhooks/... (laisser vide pour annuler le webhook dédié)"
                              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-hidden focus:border-indigo-500"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSaveCatalogWebhook(cat.id)}
                                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm shadow-indigo-600/30"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTestSingleCatalogWebhook(cat, editingWebhookValue)}
                                disabled={catalogTestStatus[cat.id]?.status === 'sending'}
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
                              >
                                <Send className="w-3.5 h-3.5 text-indigo-400" />
                                {catalogTestStatus[cat.id]?.status === 'sending' ? 'Envoi...' : 'Tester'}
                              </button>
                            </div>
                          </div>

                          {catalogTestStatus[cat.id] && (
                            <div
                              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                                catalogTestStatus[cat.id].status === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : catalogTestStatus[cat.id].status === 'error'
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                  : 'bg-indigo-950/30 text-indigo-300 border border-indigo-500/20 animate-pulse'
                              }`}
                            >
                              {catalogTestStatus[cat.id].status === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : catalogTestStatus[cat.id].status === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                              )}
                              <span>{catalogTestStatus[cat.id].message}</span>
                            </div>
                          )}

                          <p className="text-[11px] text-slate-400">
                            💡 Chaque alerte repérée sur ce catalogue sera postée sur ce salon Discord avec l'étiquette <strong>[{cat.name}]</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🎛️ SECTION 2 : CONTRÔLES & FILTRES ACHAT / REVENTE */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl transition-all">
        {/* Filter Bar Header Toggle */}
        <div
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="px-5 py-3.5 bg-slate-950/60 border-b border-white/5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-950/80 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Filtres Fins : Tailles, Budget Max & Whitelist Marques
            </span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
              ({filters.sizes.length > 0 ? `${filters.sizes.length} taille(s)` : 'Toutes tailles'} · {filters.maxPriceEnabled ? `Max ${filters.maxPrice}€` : 'Budget libre'})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleResetFilters();
              }}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              title="Réinitialiser tous les critères"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser
            </button>
            <span className="text-slate-400">
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </div>

        {/* Retractable Body */}
        {filtersOpen && (
          <div className="p-5 space-y-5 animate-fade-in text-xs">
            {/* 1. SIZES FILTER */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>Filtre des Tailles (Multi-sélection)</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {filters.sizes.length === 0 ? 'Toutes les tailles autorisées' : `${filters.sizes.length} taille(s) ciblée(s)`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSizes}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                    filters.sizes.length === 0
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 ring-1 ring-blue-500'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Toutes les tailles
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                <span className="text-[11px] text-slate-400 font-medium mr-1">Vêtements :</span>
                {CLOTHING_SIZES.map((size) => {
                  const isSelected = filters.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleToggleSize(size)}
                      className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 ring-1 ring-blue-400'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}

                <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                <span className="text-[11px] text-slate-400 font-medium mr-1">Chaussures :</span>
                {SHOE_SIZES.map((size) => {
                  const isSelected = filters.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleToggleSize(size)}
                      className={`px-2 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30 ring-1 ring-cyan-400'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. MAX PURCHASE PRICE (BUDGET) */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="maxPriceToggle"
                    checked={filters.maxPriceEnabled}
                    onChange={(e) => {
                      sounds.playClick();
                      setFilters((prev) => ({ ...prev, maxPriceEnabled: e.target.checked }));
                    }}
                    className="w-4 h-4 rounded-sm bg-slate-900 border-slate-700 text-blue-600 accent-blue-600 cursor-pointer"
                  />
                  <label htmlFor="maxPriceToggle" className="font-semibold text-slate-200 cursor-pointer">
                    Ignorer les articles au-dessus de mon budget
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 pl-6">
                  Rejette les annonces dont le prix d'achat dépasse la limite fixée pour ne pas immobiliser trop de capital.
                </p>
              </div>

              <div className="md:col-span-7 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                  <span className="text-slate-400 font-medium">Prix d'achat max :</span>
                  <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                    <input
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      disabled={!filters.maxPriceEnabled}
                      value={filters.maxPrice}
                      onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: Math.max(1, Number(e.target.value)) }))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-sm text-emerald-300 font-mono disabled:opacity-40 outline-hidden focus:border-blue-500"
                    />
                    <span>€</span>
                  </div>
                </div>

                {/* Quick budget presets */}
                <div className="flex items-center gap-1">
                  {[25, 40, 60, 80, 120].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={!filters.maxPriceEnabled}
                      onClick={() => {
                        sounds.playClick();
                        setFilters((prev) => ({ ...prev, maxPrice: preset, maxPriceEnabled: true }));
                      }}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors ${
                        filters.maxPriceEnabled && filters.maxPrice === preset
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 disabled:opacity-40'
                      }`}
                    >
                      {preset}€
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. HYPED & PROFITABLE BRANDS (WHITELIST) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Marques Connues & Hypées (Whitelist Achat/Revente)</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {filters.brandPack === 'all' && filters.customBrands.length === 0
                    ? 'Aucun filtrage de marque (toutes acceptées)'
                    : 'Filtre strict actif'}
                </span>
              </div>

              {/* Quick Brand Packs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {(Object.keys(BRAND_PACKS) as BrandPackKey[]).map((key) => {
                  const pack = BRAND_PACKS[key];
                  const isActive = filters.brandPack === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setFilters((prev) => ({ ...prev, brandPack: key }));
                      }}
                      className={`p-2.5 text-left rounded-xl border transition-all ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white">{pack.label}</span>
                        {isActive && <Check className="w-3 h-3 text-amber-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{pack.tag}</p>
                    </button>
                  );
                })}
              </div>

              {/* Custom brand tag creator */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <form onSubmit={handleAddCustomBrand} className="flex items-center gap-1.5 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newCustomBrandInput}
                      onChange={(e) => setNewCustomBrandInput(e.target.value)}
                      placeholder="Ajouter une marque personnalisée (+)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-hidden focus:border-amber-500/60"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    Ajouter
                  </button>
                </form>

                {filters.customBrands.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {filters.customBrands.map((custom) => (
                      <span
                        key={custom}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium"
                      >
                        {custom}
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomBrand(custom)}
                          className="hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar (Status level: Certified, Manual, Price Drop) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-800/70">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tous les types ({filteredAlerts.length})
          </button>
          <button
            onClick={() => setFilterType('certified')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filterType === 'certified'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🟢 Deals Certifiés
          </button>
          <button
            onClick={() => setFilterType('manual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filterType === 'manual'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🟡 Vérification Manuelle
          </button>
          <button
            onClick={() => setFilterType('price_drop')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filterType === 'price_drop'
                ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📉 Baisses de Prix
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par marque, catalogue ou titre..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-hidden focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleCleanAlerts}
            disabled={alerts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95 shadow-xs"
            title="Nettoyer et vider la liste des opportunités"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clean ({alerts.length})</span>
          </button>
        </div>
      </div>

      {/* Live Alerts Stream */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
          <span className="font-semibold uppercase tracking-wider flex items-center gap-2">
            <span>Opportunités ciblées détectées ({filteredAlerts.length})</span>
            {isPolling && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Scan : {activeCatalogScanning}...
              </span>
            )}
          </span>

          <div className="flex items-center gap-3">
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={handleCleanAlerts}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer active:scale-95"
                title="Vider et nettoyer toutes les opportunités"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean ({alerts.length})</span>
              </button>
            )}
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Clock className="w-3 h-3" />
              100% annonces réelles
            </span>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 text-slate-400 text-xs space-y-2">
            <Radio className="w-8 h-8 text-amber-400/50 mx-auto animate-pulse" />
            <p className="text-slate-200 font-medium">En attente de pépites sur vos catalogues ciblés...</p>
            <p className="text-slate-400 max-w-md mx-auto text-[11px]">
              Le bot alterne en boucle la surveillance entre vos catalogues actifs toutes les 3.5 secondes. Dès qu'un article réel sous-évalué apparaît dans l'un d'eux, il est instantanément affiché avec son badge catalogue et expédié sur Discord.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAlerts.map((alert) => {
              const canonicalUrl = `https://www.vinted.fr/items/${alert.id}`;

              return (
                <div
                  key={alert.id}
                  className="group p-5 bg-slate-900/90 rounded-2xl border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 transition-all flex flex-col justify-between gap-4"
                >
                  <div>
                    {/* Catalog Badge + Alert Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        {/* 🎯 CATALOG BADGE */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          <Target className="w-3 h-3 text-blue-400" />
                          <span>Trouvé dans : {alert.catalogName || 'Catalogue Général'}</span>
                        </span>

                        {alert.alertType === 'price_drop' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <ArrowDownRight className="w-3 h-3" />
                            📉 Baisse
                          </span>
                        ) : alert.alertType === 'certified' || alert.isCertified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            🟢 Certifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            🟡 À vérifier
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {typeof alert.detectedAt === 'string'
                              ? new Date(alert.detectedAt).toLocaleTimeString('fr-FR')
                              : alert.detectedAt instanceof Date
                              ? alert.detectedAt.toLocaleTimeString('fr-FR')
                              : 'Récemment'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveAlert(alert.id, e)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Supprimer cette opportunité"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title and Thumbnail */}
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                        {alert.imageUrl ? (
                          <img
                            src={alert.imageUrl}
                            alt={alert.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl">{alert.imageThumbnail}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-white leading-snug line-clamp-2 hover:text-blue-400 transition-colors block"
                        >
                          {alert.title}
                        </a>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                          <span className="text-slate-300 font-medium">{alert.brand}</span>
                          <span aria-hidden="true">·</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 font-mono font-semibold">
                            Taille {alert.size}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">{alert.condition}</span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Comparison */}
                    <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                          Prix Vendeur
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          {alert.previousPrice && (
                            <span className="text-xs font-mono text-slate-500 line-through">
                              {alert.previousPrice} €
                            </span>
                          )}
                          <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                            {alert.sellerPrice} €
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                          Cote Estimée
                        </span>
                        <span className="text-xs font-mono text-slate-400 line-through tabular-nums">
                          {alert.marketPrice} €
                        </span>
                      </div>

                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        -{alert.discountPercentage}%
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span className="truncate">
                        Vendeur : <strong className="text-slate-300 font-normal">@{alert.sellerName}</strong>
                      </span>
                      <span className="font-mono text-slate-400 shrink-0">
                        {alert.sellerRating > 0 ? `★ ${alert.sellerRating} (${alert.sellerReviewsCount} avis)` : 'Compte récent'}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleBuyDirect(alert)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Acheter en direct
                      <ExternalLink className="w-3 h-3 text-blue-200" />
                    </button>

                    <button
                      onClick={() => handleOpenDeal(alert)}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                      title="Inspecter le rapport"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    {(() => {
                      const matchedCat = catalogs.find((c) => c.id === alert.catalogId || c.name === alert.catalogName);
                      const targetHook = matchedCat?.discordWebhookUrl?.trim() || discordWebhookUrl?.trim();
                      if (!targetHook) return null;

                      return (
                        <button
                          onClick={() => {
                            sendToDiscord(alert, targetHook, true);
                            sounds.playSuccess();
                          }}
                          className={`p-2.5 rounded-xl border transition-colors ${
                            matchedCat?.discordWebhookUrl
                              ? 'bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-300 border-indigo-500/30'
                              : 'bg-slate-950 hover:bg-slate-800 text-indigo-400 border-slate-800'
                          }`}
                          title={
                            matchedCat?.discordWebhookUrl
                              ? `Envoyer sur le Webhook dédié de « ${matchedCat.name} »`
                              : 'Envoyer manuellement sur Discord'
                          }
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy Direct Inspection Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedDeal(null)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  🎯 Trouvé dans : {selectedDeal.catalogName || 'Catalogue Général'}
                </span>

                {selectedDeal.alertType === 'price_drop' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    📉 Baisse de Prix
                  </span>
                ) : selectedDeal.isCertified ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    🟢 Deal Certifié
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    🟡 Vérification Manuelle
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">ID: #{selectedDeal.id}</span>
              </div>
              <h3 className="text-base font-bold text-white leading-tight">
                {selectedDeal.title}
              </h3>
            </div>

            {/* Economics recap */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <div>
                <span className="text-[11px] text-slate-400 block">Prix annonce</span>
                <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {selectedDeal.sellerPrice} €
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Cote estimée</span>
                <span className="text-lg font-bold font-mono text-slate-300 tabular-nums">
                  {selectedDeal.marketPrice} €
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Marge brute</span>
                <span className="text-lg font-bold font-mono text-blue-400 tabular-nums">
                  +{selectedDeal.marketPrice - selectedDeal.sellerPrice} €
                </span>
              </div>
            </div>

            {/* AI Diagnosis Reason */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-slate-200 block flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                Rapport de détection :
              </span>
              <p className="text-slate-400 leading-relaxed">{selectedDeal.anomalyReason}</p>
            </div>

            {/* Canonical link preview */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 truncate">
              URL canonique : <span className="text-blue-400">https://www.vinted.fr/items/{selectedDeal.id}</span>
            </div>

            {/* Direct purchase trigger */}
            <div className="pt-2">
              <button
                onClick={() => handleBuyDirect(selectedDeal)}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir l'annonce sur Vinted & Acheter en direct
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discord Webhook Configuration Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowWebhookModal(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <BellRing className="w-4 h-4" />
                <span>Intégration Discord</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Configuration du Webhook Discord
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Reçois automatiquement chaque opportunité réelle dans ton salon Discord avec embed stylisé, lien canonique et étiquette du catalogue d'origine.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  URL du Webhook Discord
                </label>
                <input
                  type="url"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/1234567890/abcdef..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono outline-hidden"
                />
              </div>

              {/* Automatic toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Notification automatique en temps réel
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Déclencher l'embed Discord dès qu'une pépite conforme est trouvée
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscordAutoSend(!discordAutoSend)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    discordAutoSend ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      discordAutoSend ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Test status banner */}
              {discordTestMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    discordTestStatus === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : discordTestStatus === 'error'
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  {discordTestStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : discordTestStatus === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                  <span>{discordTestMessage}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestDiscordWebhook}
                  disabled={discordTestStatus === 'sending'}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  Tester le Webhook
                </button>

                <button
                  type="button"
                  onClick={handleSaveDiscordSettings}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
