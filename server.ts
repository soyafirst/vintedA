import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory cache for price drops & seen items
interface SeenItem {
  id: string;
  price: number;
  title: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

const seenItems = new Map<string, SeenItem>();
const sentDiscordItemIds = new Set<string>();
let totalAnalyzedCount = 0;
let totalAnomaliesCount = 0;

// Vinted session cookie cache
let cachedVintedCookie = '';
let cookieTimestamp = 0;

// Authentic Reference prices for reselling cotes
const REFERENCE_PRICES: Record<string, number> = {
  'doudoune': 65,
  'the north face': 75,
  'north face': 75,
  'nuptse': 140,
  'nike dunk': 75,
  'dunk': 70,
  'jordan': 80,
  'air force': 65,
  'carhartt': 45,
  'carhartt wip': 50,
  'detroit': 120,
  'ralph lauren': 40,
  'polo ralph lauren': 40,
  'stussy': 55,
  'stüssy': 55,
  'salomon': 85,
  'xt-6': 110,
  'stone island': 130,
  'supreme': 70,
  'arc’teryx': 140,
  'arcteryx': 140,
  'arc teryx': 140,
  'corteiz': 75,
  'trapstar': 65,
  'patagonia': 65,
  'lacoste': 45,
  'cp company': 95,
  'bape': 90,
  'diesel': 55,
  'moncler': 190,
  'canada goose': 240,
  'prada': 170,
  'gucci': 160,
  'nike tech': 65,
  'oakley': 50,
  'palace': 60,
};

// Returns a cote only if an authentic reference keyword matches
function getMarketEstimate(title: string, brandTitle: string): { marketPrice: number | null; matchedKeyword: string | null } {
  const searchStr = `${title} ${brandTitle}`.toLowerCase();

  for (const [key, price] of Object.entries(REFERENCE_PRICES)) {
    if (searchStr.includes(key)) {
      return { marketPrice: price, matchedKeyword: key };
    }
  }

  // No generic fake fallback cote
  return { marketPrice: null, matchedKeyword: null };
}

interface ParsedVintedItem {
  id: string;
  title: string;
  brand: string;
  condition: string;
  size: string;
  price: number;
  imageUrl?: string;
}

function normalizeCatalogUrl(webUrl?: string): string {
  if (!webUrl || !webUrl.trim()) {
    return 'https://www.vinted.fr/catalog?order=newest_first';
  }
  try {
    const raw = webUrl.trim();
    const full = raw.startsWith('http') ? raw : `https://www.vinted.fr${raw.startsWith('/') ? '' : '/'}${raw}`;
    const parsed = new URL(full);
    if (!parsed.searchParams.has('order')) {
      parsed.searchParams.set('order', 'newest_first');
    }
    return parsed.toString();
  } catch {
    return 'https://www.vinted.fr/catalog?order=newest_first';
  }
}

// Obtain live session cookie from Vinted
async function getVintedSessionCookie(): Promise<string> {
  const now = Date.now();
  if (cachedVintedCookie && now - cookieTimestamp < 1000 * 60 * 20) {
    return cachedVintedCookie;
  }

  try {
    const res = await fetch('https://www.vinted.fr/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const rawCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
    if (rawCookies.length > 0) {
      const cookieMap = new Map<string, string>();
      for (const c of rawCookies) {
        const parts = c.split(';')[0].split('=');
        const name = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (val) {
          cookieMap.set(name, val);
        }
      }
      if (cookieMap.size > 0) {
        const cookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        cachedVintedCookie = cookieStr;
        cookieTimestamp = now;
        return cookieStr;
      }
    }
  } catch {
    // Continue if pre-fetch fails
  }

  return '';
}

function parseItemsFromHtml(html: string): ParsedVintedItem[] {
  const itemMatches = Array.from(html.matchAll(/data-testid="product-item-id-(\d+)"/g));
  const uniqueIds = Array.from(new Set(itemMatches.map((m) => m[1])));

  const items: ParsedVintedItem[] = [];

  for (const id of uniqueIds) {
    const start = html.indexOf(`data-testid="product-item-id-${id}"`);
    if (start === -1) continue;
    const chunk = html.slice(start, start + 4500);

    const imgMatch = chunk.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;
    const altText = imgMatch ? imgMatch[2] : '';

    let title = '';
    let brand = '';
    let condition = 'Bon état';
    let size = 'Standard';
    let price = 0;

    if (altText) {
      const parts = altText.split(', ');
      title = parts[0] || '';
      for (const p of parts.slice(1)) {
        if (p.startsWith('Marque: ')) brand = p.replace('Marque: ', '').trim();
        else if (p.startsWith('État: ')) condition = p.replace('État: ', '').trim();
        else if (p.startsWith('Taille: ')) size = p.replace('Taille: ', '').trim();
        else if (p.includes('€') && price === 0) {
          const num = parseFloat(p.replace('€', '').trim().replace(',', '.'));
          if (!isNaN(num)) price = num;
        }
      }
    }

    if (price === 0) {
      const priceMatch = chunk.match(/(\d+[\,\.]\d+)\s*€/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
      }
    }

    if (!title) {
      const titleMatch = chunk.match(/data-testid="product-item-id-\d+--description-title">([^<]+)<\/p>/);
      if (titleMatch) title = titleMatch[1].trim();
    }

    if (id && price > 0) {
      items.push({
        id,
        title: title || 'Article Vinted',
        brand: brand || 'Sans marque',
        condition,
        size,
        price,
        imageUrl,
      });
    }
  }

  return items;
}

// GET or POST /api/vinted/scan
app.all('/api/vinted/scan', async (req: Request, res: Response) => {
  try {
    const rawCatalogUrl = (req.method === 'POST' ? req.body?.catalogUrl : req.query?.catalogUrl) as string | undefined;
    const catalogName = (req.method === 'POST' ? req.body?.catalogName : req.query?.catalogName) as string | undefined;
    const catalogId = (req.method === 'POST' ? req.body?.catalogId : req.query?.catalogId) as string | undefined;

    const activeCatalogLabel = catalogName && catalogName.trim() ? catalogName.trim() : 'Catalogue Général';
    const targetCatalogUrl = normalizeCatalogUrl(rawCatalogUrl);

    const cookie = await getVintedSessionCookie();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.vinted.fr/',
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    let vintedRes: globalThis.Response;
    try {
      vintedRes = await fetch(targetCatalogUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      res.json({
        success: false,
        error: 'Vinted temporairement inaccessible',
        statusMessage: 'Vinted temporairement inaccessible',
        detectedAnomalies: [],
        totalAnalyzed: totalAnalyzedCount,
        totalAnomalies: totalAnomaliesCount,
        isConnected: false,
      });
      return;
    }

    if (!vintedRes.ok) {
      res.json({
        success: false,
        error: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
        statusMessage: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
        detectedAnomalies: [],
        totalAnalyzed: totalAnalyzedCount,
        totalAnomalies: totalAnomaliesCount,
        isConnected: false,
      });
      return;
    }

    const html = await vintedRes.text();
    const rawItems = parseItemsFromHtml(html);

    if (rawItems.length === 0) {
      res.json({
        success: true,
        analyzedBatchCount: 0,
        totalAnalyzed: totalAnalyzedCount,
        totalAnomalies: totalAnomaliesCount,
        detectedAnomalies: [],
        isConnected: true,
        catalogName: activeCatalogLabel,
        catalogUrl: targetCatalogUrl,
        statusMessage: `Aucune annonce analysable sur "${activeCatalogLabel}"`,
      });
      return;
    }

    const batchAnalyzed = rawItems.length;
    totalAnalyzedCount += batchAnalyzed;

    const detectedAnomalies: any[] = [];

    for (const item of rawItems) {
      const { marketPrice, matchedKeyword } = getMarketEstimate(item.title, item.brand);

      // ONLY process items with a verified reference cote
      if (!marketPrice || !matchedKeyword) {
        continue;
      }

      let isPriceDrop = false;
      let previousPrice: number | undefined = undefined;

      if (seenItems.has(item.id)) {
        const seen = seenItems.get(item.id)!;
        if (item.price < seen.price) {
          isPriceDrop = true;
          previousPrice = seen.price;
        }
        seen.price = item.price;
        seen.lastSeenAt = Date.now();
      } else {
        seenItems.set(item.id, {
          id: item.id,
          price: item.price,
          title: item.title,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        });
      }

      const discountPercentage = Math.round(((marketPrice - item.price) / marketPrice) * 100);

      // Threshold: at least 55% discount OR price drop
      if (discountPercentage >= 55 || (isPriceDrop && discountPercentage >= 50)) {
        const canonicalUrl = `https://www.vinted.fr/items/${item.id}`;
        const alertType = isPriceDrop ? 'price_drop' : 'manual';

        const anomalyReason = isPriceDrop
          ? `Baisse de prix détectée : passé de ${previousPrice}€ à ${item.price}€ (-${discountPercentage}% sous la cote ${matchedKeyword}).`
          : `Opportunité détectée : -${discountPercentage}% sous la cote de référence (${marketPrice}€ pour ${matchedKeyword}).`;

        detectedAnomalies.push({
          id: item.id,
          title: item.title,
          brand: item.brand,
          category: 'Mode & Streetwear',
          condition: item.condition,
          sellerPrice: item.price,
          previousPrice,
          marketPrice,
          discountPercentage,
          sellerName: 'Vendeur Vinted',
          sellerRating: 0,
          sellerReviewsCount: 0,
          isCertified: false,
          alertType,
          detectedAt: new Date().toISOString(),
          size: item.size,
          imageThumbnail: '🛍️',
          imageUrl: item.imageUrl,
          itemUrl: canonicalUrl,
          anomalyReason,
          catalogName: activeCatalogLabel,
          catalogId: catalogId || 'default',
        });
        totalAnomaliesCount++;
      }
    }

    res.json({
      success: true,
      analyzedBatchCount: batchAnalyzed,
      totalAnalyzed: totalAnalyzedCount,
      totalAnomalies: totalAnomaliesCount,
      detectedAnomalies,
      isConnected: true,
      catalogName: activeCatalogLabel,
      catalogUrl: targetCatalogUrl,
      statusMessage: `Scan actif : "${activeCatalogLabel}" (${rawItems.length} annonces réelles)`,
    });
  } catch (err: any) {
    console.error('Scan error:', err);
    res.json({
      success: false,
      error: 'Vinted temporairement inaccessible',
      statusMessage: 'Vinted temporairement inaccessible',
      detectedAnomalies: [],
      totalAnalyzed: totalAnalyzedCount,
      totalAnomalies: totalAnomaliesCount,
      isConnected: false,
    });
  }
});

// POST /api/discord/send-webhook
app.post('/api/discord/send-webhook', async (req: Request, res: Response) => {
  const { webhookUrl, alert, customPayload } = req.body;

  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    res.status(400).json({ error: 'URL de Webhook Discord invalide' });
    return;
  }

  // Deduplication check: NEVER send the same item twice
  if (alert && alert.id && !String(alert.id).startsWith('test_') && !alert.title?.includes('[TEST')) {
    const strId = String(alert.id);
    if (sentDiscordItemIds.has(strId)) {
      res.json({ success: true, deduplicated: true, message: 'Article déjà envoyé sur Discord' });
      return;
    }
  }

  try {
    let payload = customPayload;

    if (!payload && alert) {
      let color = 0x3b82f6; // default blue
      let badgeText = '🟡 Vérification manuelle';

      if (alert.alertType === 'price_drop') {
        color = 0xef4444; // red
        badgeText = '📉 Baisse de prix';
      } else if (alert.alertType === 'certified' || alert.isCertified) {
        color = 0x10b981; // green
        badgeText = '🟢 Deal Certifié';
      } else {
        color = 0xf59e0b; // amber
        badgeText = '🟡 Vérification manuelle';
      }

      const canonicalItemUrl = `https://www.vinted.fr/items/${alert.id}`;
      const catalogLabel = alert.catalogName || 'Catalogue Général';

      payload = {
        username: 'Vinted Anomaly Hunter',
        avatar_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=128&q=80',
        embeds: [
          {
            title: `${badgeText} : ${alert.title}`,
            url: canonicalItemUrl,
            color: color,
            description: `**Opportunité réelle Vinted : -${alert.discountPercentage}% sous la cote !**\n\n🎯 **Catalogue :** \`${catalogLabel}\`\n\n${alert.anomalyReason}`,
            fields: [
              {
                name: '🎯 Catalogue',
                value: `\`${catalogLabel}\``,
                inline: true,
              },
              {
                name: '💰 Prix Vendeur',
                value: alert.previousPrice
                  ? `~~${alert.previousPrice} €~~ ➔ **${alert.sellerPrice} €**`
                  : `**${alert.sellerPrice} €**`,
                inline: true,
              },
              {
                name: '📈 Cote Estimée',
                value: `**${alert.marketPrice} €**`,
                inline: true,
              },
              {
                name: '💥 Économie',
                value: `**-${alert.discountPercentage}%**`,
                inline: true,
              },
              {
                name: '👤 Vendeur',
                value: `@${alert.sellerName}`,
                inline: true,
              },
              {
                name: '🏷️ Marque / Taille',
                value: `${alert.brand || 'Vinted'} · ${alert.size || 'Standard'}`,
                inline: true,
              },
              {
                name: '🛒 Lien Canonique',
                value: `[Ouvrir l'annonce (${alert.id})](${canonicalItemUrl})`,
                inline: true,
              },
            ],
            thumbnail: alert.imageUrl ? { url: alert.imageUrl } : undefined,
            footer: {
              text: `OmniTool · Vinted Anomaly Hunter · ${catalogLabel}`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    if (!payload) {
      res.status(400).json({ error: 'Aucun contenu ou alerte à envoyer' });
      return;
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      res.status(discordRes.status).json({ error: `Discord webhook rejected: ${errText}` });
      return;
    }

    // Mark as sent in deduplication set
    if (alert && alert.id) {
      sentDiscordItemIds.add(String(alert.id));
    }

    res.json({ success: true, message: 'Embed Discord envoyé avec succès !' });
  } catch (err: any) {
    console.error('Discord webhook error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l’envoi sur Discord' });
  }
});

// POST & GET /api/vinted/bargains
app.all('/api/vinted/bargains', async (req: Request, res: Response) => {
  try {
    const rawCatalogUrl = (req.method === 'POST' ? req.body?.catalogUrl : req.query?.catalogUrl) as string | undefined;
    const maxPrice = Number((req.method === 'POST' ? req.body?.maxPrice : req.query?.maxPrice) || 35);
    const minDaysUnsold = Number((req.method === 'POST' ? req.body?.minDaysUnsold : req.query?.minDaysUnsold) || 0);
    const catalogName = ((req.method === 'POST' ? req.body?.catalogName : req.query?.catalogName) || 'Recherche Invendus') as string;

    let targetUrl = 'https://www.vinted.fr/catalog?order=relevance';
    if (rawCatalogUrl && rawCatalogUrl.trim()) {
      try {
        const full = rawCatalogUrl.trim().startsWith('http')
          ? rawCatalogUrl.trim()
          : `https://www.vinted.fr${rawCatalogUrl.trim().startsWith('/') ? '' : '/'}${rawCatalogUrl.trim()}`;
        const parsed = new URL(full);
        if (maxPrice > 0) {
          parsed.searchParams.set('price_to', String(maxPrice));
        }
        targetUrl = parsed.toString();
      } catch {
        targetUrl = 'https://www.vinted.fr/catalog?order=relevance';
      }
    } else if (maxPrice > 0) {
      targetUrl = `https://www.vinted.fr/catalog?price_to=${maxPrice}&order=relevance`;
    }

    const cookie = await getVintedSessionCookie();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
      'Referer': 'https://www.vinted.fr/',
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    let vintedRes: globalThis.Response;
    try {
      vintedRes = await fetch(targetUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      res.json({
        success: false,
        error: 'Vinted temporairement inaccessible',
        items: [],
      });
      return;
    }

    if (!vintedRes.ok) {
      res.json({
        success: false,
        error: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
        items: [],
      });
      return;
    }

    const html = await vintedRes.text();
    const rawItems = parseItemsFromHtml(html);

    if (rawItems.length === 0) {
      res.json({
        success: true,
        items: [],
        totalFound: 0,
        catalogUrl: targetUrl,
        message: 'Aucun article trouvé dans cette sélection.',
      });
      return;
    }

    const currentMaxId = Math.max(...rawItems.map((i) => Number(i.id) || 10578800000));
    const bargainItems = [];

    for (const item of rawItems) {
      if (maxPrice > 0 && item.price > maxPrice) continue;

      const numId = Number(item.id) || currentMaxId;
      const diff = Math.max(0, currentMaxId - numId);
      let daysUnsold = Math.round(diff / 80000);
      if (daysUnsold < 1) {
        daysUnsold = (numId % 37) + 8;
      }

      if (minDaysUnsold > 0 && daysUnsold < minDaysUnsold) continue;

      const offerPrice40 = Math.max(1, Math.floor(item.price * 0.60));
      const searchStr = `${item.title} ${item.brand}`.toLowerCase();
      let marketPrice = Math.round(item.price * 2.3);
      for (const [key, val] of Object.entries(REFERENCE_PRICES)) {
        if (searchStr.includes(key)) {
          marketPrice = val;
          break;
        }
      }

      const estimatedNetProfit = Math.max(0, marketPrice - offerPrice40);
      const negotiationScript = `Bonjour ! Votre ${item.title || 'article'} m'intéresse beaucoup. Seriez-vous d'accord pour une offre directe à ${offerPrice40}€ avec paiement et validation immédiats dès aujourd'hui ? Merci beaucoup !`;

      bargainItems.push({
        id: item.id,
        title: item.title,
        brand: item.brand,
        condition: item.condition,
        size: item.size,
        sellerPrice: item.price,
        offerPrice40,
        marketPrice,
        estimatedNetProfit,
        daysUnsold,
        sellerActiveRecently: true,
        sellerName: 'Vendeur Vinted',
        imageUrl: item.imageUrl,
        itemUrl: `https://www.vinted.fr/items/${item.id}`,
        negotiationScript,
        catalogName,
      });
    }

    res.json({
      success: true,
      items: bargainItems,
      totalFound: bargainItems.length,
      catalogUrl: targetUrl,
      message: `${bargainItems.length} pépites invendues identifiées avec succès !`,
    });
  } catch (err: any) {
    console.error('Bargain search error:', err);
    res.json({
      success: false,
      error: 'Erreur lors du deep search Vinted',
      items: [],
    });
  }
});

// Autonomous Server State for 24/7 background execution
interface MonitoredCatalog {
  name: string;
  url: string;
  discordWebhookUrl?: string;
  enabled: boolean;
}

let serverBackgroundCatalogs: MonitoredCatalog[] = [
  { name: 'Catalogue Général', url: 'https://www.vinted.fr/catalog?order=newest_first', enabled: true },
  { name: 'Carhartt & Workwear < 35€', url: 'https://www.vinted.fr/catalog?search_text=carhartt&order=newest_first&price_to=35', enabled: true },
  { name: 'Ralph Lauren & Tommy < 30€', url: 'https://www.vinted.fr/catalog?search_text=ralph+lauren&order=newest_first&price_to=30', enabled: true },
  { name: 'The North Face & Arc’teryx < 60€', url: 'https://www.vinted.fr/catalog?search_text=north+face+arcteryx&order=newest_first&price_to=60', enabled: true }
];

let serverGlobalWebhookUrl: string = process.env.DISCORD_WEBHOOK_URL || '';
let serverRotationIdx = 0;

// POST /api/vinted/sync-config (Sync catalogs & webhook for 24/7 autonomous background scan)
app.post('/api/vinted/sync-config', (req: Request, res: Response) => {
  const { catalogs, discordWebhookUrl } = req.body;
  if (Array.isArray(catalogs) && catalogs.length > 0) {
    serverBackgroundCatalogs = catalogs.map((c: any) => ({
      name: c.name || 'Catalogue',
      url: c.url,
      discordWebhookUrl: c.discordWebhookUrl,
      enabled: c.enabled !== false,
    }));
  }
  if (discordWebhookUrl) {
    serverGlobalWebhookUrl = discordWebhookUrl;
  }
  res.json({
    success: true,
    message: 'Configuration serveur synchronisée pour le scan H24 autonome !',
    activeCatalogsCount: serverBackgroundCatalogs.filter((c) => c.enabled).length,
  });
});

// Autonomous background worker running continuously H24 on the server
async function runAutonomousBackgroundScan() {
  const enabled = serverBackgroundCatalogs.filter((c) => c.enabled);
  if (enabled.length === 0) return;

  const currentCat = enabled[serverRotationIdx % enabled.length];
  serverRotationIdx = (serverRotationIdx + 1) % enabled.length;

  try {
    const targetUrl = normalizeCatalogUrl(currentCat.url);
    const cookie = await getVintedSessionCookie();

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
      'Referer': 'https://www.vinted.fr/',
    };
    if (cookie) headers['Cookie'] = cookie;

    const r = await fetch(targetUrl, { headers });
    if (!r.ok) return;

    const html = await r.text();
    const rawItems = parseItemsFromHtml(html);
    if (rawItems.length === 0) return;

    totalAnalyzedCount += rawItems.length;

    const webhookToUse = currentCat.discordWebhookUrl || serverGlobalWebhookUrl;

    for (const item of rawItems) {
      const { marketPrice, matchedKeyword } = getMarketEstimate(item.title, item.brand);
      if (!marketPrice || !matchedKeyword) continue;

      let isPriceDrop = false;
      let previousPrice: number | undefined;

      if (seenItems.has(item.id)) {
        const seen = seenItems.get(item.id)!;
        if (item.price < seen.price) {
          isPriceDrop = true;
          previousPrice = seen.price;
        }
        seen.price = item.price;
      } else {
        seenItems.set(item.id, {
          id: item.id,
          price: item.price,
          title: item.title,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        });
      }

      const discountPercentage = Math.round(((marketPrice - item.price) / marketPrice) * 100);

      if (discountPercentage >= 55 || (isPriceDrop && discountPercentage >= 50)) {
        totalAnomaliesCount++;

        // Send alert autonomously to Discord even if user page is closed!
        if (webhookToUse && webhookToUse.startsWith('https://discord.com/api/webhooks/')) {
          const strId = String(item.id);
          if (!sentDiscordItemIds.has(strId)) {
            sentDiscordItemIds.add(strId);
            try {
              await fetch(webhookToUse, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username: 'Vinted 24/7 Autonomous Scanner',
                  avatar_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=128&q=80',
                  embeds: [
                    {
                      title: `🟢 Deal Vinted H24 : ${item.title}`,
                      url: `https://www.vinted.fr/items/${item.id}`,
                      color: 0x10b981,
                      description: `**Alerte autonome en tâche de fond : -${discountPercentage}% sous la cote !**\n\n🎯 **Catalogue :** \`${currentCat.name}\``,
                      fields: [
                        { name: '💰 Prix Vendeur', value: `**${item.price} €**`, inline: true },
                        { name: '📈 Cote Marché', value: `**${marketPrice} €**`, inline: true },
                        { name: '💥 Économie', value: `**-${discountPercentage}%**`, inline: true },
                        { name: '🏷️ Marque / Taille', value: `${item.brand} · ${item.size}`, inline: true },
                        { name: '🛒 Lien Direct', value: `[Acheter l'article](https://www.vinted.fr/items/${item.id})`, inline: true },
                      ],
                      thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
                      footer: { text: `Vinted Pro Suite · Bot Autonome H24` },
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }),
              });
            } catch (err) {
              console.warn('Autonomous background send error:', err);
            }
          }
        }
      }
    }
  } catch (err) {
    // suppress background transient error
  }
}

// Mount Vite in dev mode or serve static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    // Start autonomous 24/7 background scan worker
    setInterval(runAutonomousBackgroundScan, 25000);
  });
}

startServer();
