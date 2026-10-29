// Vercel Serverless Function: POST /api/discord/send-webhook
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

const sentDiscordItemIds = new Set<string>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

    const { webhookUrl, alert, customPayload } = bodyData;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ error: 'URL de Webhook Discord invalide' });
    }

    // Deduplication check: NEVER send the same real item twice to Discord
    if (alert && alert.id && !String(alert.id).startsWith('test_') && !alert.title?.includes('[TEST')) {
      const strId = String(alert.id);
      if (sentDiscordItemIds.has(strId)) {
        return res.status(200).json({ success: true, deduplicated: true, message: 'Article déjà envoyé sur Discord' });
      }
    }

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
      return res.status(400).json({ error: 'Aucun contenu ou alerte à envoyer' });
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      return res.status(discordRes.status).json({ error: `Discord webhook rejected: ${errText}` });
    }

    if (alert && alert.id) {
      sentDiscordItemIds.add(String(alert.id));
    }

    return res.status(200).json({ success: true, message: 'Embed Discord envoyé avec succès !' });
  } catch (err: any) {
    console.error('Discord webhook error:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de l’envoi sur Discord' });
  }
}
