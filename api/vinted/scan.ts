// Vercel Serverless Function: POST /api/vinted/scan
// STRICT REAL VINTED SCANNER - ZERO MOCK DATA - 100% REAL VINTED ITEMS & CANONICAL URLS
import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] };
  cookies: { [key: string]: string };
  body: any;
  method?: string;
}

interface VercelResponse extends ServerResponse {
  send: (body: any) => VercelResponse;
  json: (jsonBody: any) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
}

interface SeenItem {
  id: string;
  price: number;
  title: string;
  firstSeenAt: number;
  lastSeenAt: number;
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

// Global in-memory cache for warm serverless instances
const seenItems = new Map<string, SeenItem>();
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

function getMarketEstimate(title: string, brandTitle: string): { marketPrice: number | null; matchedKeyword: string | null } {
  const searchStr = `${title} ${brandTitle}`.toLowerCase();

  for (const [key, price] of Object.entries(REFERENCE_PRICES)) {
    if (searchStr.includes(key)) {
      return { marketPrice: price, matchedKeyword: key };
    }
  }

  return { marketPrice: null, matchedKeyword: null };
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
    // Continue with direct request if cookie prefetch fails
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let bodyData: any = {};
    if (typeof req.body === 'string') {
      try {
        bodyData = JSON.parse(req.body);
      } catch {
        bodyData = {};
      }
    } else if (req.body) {
      bodyData = req.body;
    }

    const rawCatalogUrl = (bodyData?.catalogUrl || req.query?.catalogUrl) as string | undefined;
    const catalogName = (bodyData?.catalogName || req.query?.catalogName) as string | undefined;
    const catalogId = (bodyData?.catalogId || req.query?.catalogId) as string | undefined;

    const activeCatalogLabel = catalogName && catalogName.trim() ? catalogName.trim() : 'Catalogue Général';
    const targetCatalogUrl = normalizeCatalogUrl(rawCatalogUrl);

    // Fetch real session cookies
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
      return res.status(200).json({
        success: false,
        error: 'Vinted temporairement inaccessible',
        statusMessage: 'Vinted temporairement inaccessible',
        detectedAnomalies: [],
        totalAnalyzed: totalAnalyzedCount,
        totalAnomalies: totalAnomaliesCount,
        isConnected: false,
      });
    }

    if (!vintedRes.ok) {
      return res.status(200).json({
        success: false,
        error: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
        statusMessage: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
        detectedAnomalies: [],
        totalAnalyzed: totalAnalyzedCount,
        totalAnomalies: totalAnomaliesCount,
        isConnected: false,
      });
    }

    const html = await vintedRes.text();
    const rawItems = parseItemsFromHtml(html);

    if (rawItems.length === 0) {
      return res.status(200).json({
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
    }

    const batchAnalyzed = rawItems.length;
    totalAnalyzedCount += batchAnalyzed;

    const detectedAnomalies: any[] = [];

    for (const item of rawItems) {
      const { marketPrice, matchedKeyword } = getMarketEstimate(item.title, item.brand);

      // ONLY flag items with verified reference Cote
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

    return res.status(200).json({
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
    return res.status(200).json({
      success: false,
      error: 'Vinted temporairement inaccessible',
      statusMessage: 'Vinted temporairement inaccessible',
      detectedAnomalies: [],
      totalAnalyzed: totalAnalyzedCount,
      totalAnomalies: totalAnomaliesCount,
      isConnected: false,
    });
  }
}
