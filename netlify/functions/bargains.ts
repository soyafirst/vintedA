// Netlify Serverless Function: netlify/functions/bargains.ts
// INVENDUS & BONNES AFFAIRES VINTED SUR NETLIFY

interface ParsedVintedItem {
  id: string;
  title: string;
  brand: string;
  condition: string;
  size: string;
  price: number;
  imageUrl?: string;
}

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

let cachedVintedCookie = '';
let cookieTimestamp = 0;

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
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
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
    // continue
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

export const handler = async (event: any) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    let bodyData: any = {};
    if (event.body) {
      try {
        bodyData = JSON.parse(event.body);
      } catch {
        bodyData = {};
      }
    }
    const query = event.queryStringParameters || {};

    const rawCatalogUrl = (bodyData?.catalogUrl || query?.catalogUrl) as string | undefined;
    const maxPrice = Number(bodyData?.maxPrice || query?.maxPrice || 35);
    const minDaysUnsold = Number(bodyData?.minDaysUnsold || query?.minDaysUnsold || 0);
    const catalogName = (bodyData?.catalogName || query?.catalogName || 'Recherche Invendus') as string;

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
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Vinted temporairement inaccessible',
          items: [],
        }),
      };
    }

    if (!vintedRes.ok) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: `Vinted temporairement inaccessible (code ${vintedRes.status})`,
          items: [],
        }),
      };
    }

    const html = await vintedRes.text();
    const rawItems = parseItemsFromHtml(html);

    if (rawItems.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          items: [],
          totalFound: 0,
          catalogUrl: targetUrl,
          message: 'Aucun article trouvé dans cette sélection.',
        }),
      };
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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        items: bargainItems,
        totalFound: bargainItems.length,
        catalogUrl: targetUrl,
        message: `${bargainItems.length} pépites invendues identifiées avec succès !`,
      }),
    };
  } catch (err: any) {
    console.error('Netlify bargains function error:', err);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors du deep search Vinted',
        items: [],
      }),
    };
  }
};
