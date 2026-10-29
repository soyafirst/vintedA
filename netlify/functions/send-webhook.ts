// Netlify Serverless Function: netlify/functions/send-webhook.ts
// DISPATCH DISCORD SUR NETLIFY AVEC DÉDUPLICATION STRICTE

const sentDiscordItemIds = new Set<string>();

export const handler = async (event: any) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { webhookUrl, alert, customPayload } = bodyData;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'URL de Webhook Discord invalide' }),
      };
    }

    // Deduplication check
    if (alert && alert.id && !String(alert.id).startsWith('test_') && !alert.title?.includes('[TEST')) {
      const strId = String(alert.id);
      if (sentDiscordItemIds.has(strId)) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, deduplicated: true, message: 'Article déjà envoyé sur Discord' }),
        };
      }
    }

    let payload = customPayload;

    if (!payload && alert) {
      let color = 0x3b82f6;
      let badgeText = '🟡 Vérification manuelle';

      if (alert.alertType === 'price_drop') {
        color = 0xef4444;
        badgeText = '📉 Baisse de prix';
      } else if (alert.alertType === 'certified' || alert.isCertified) {
        color = 0x10b981;
        badgeText = '🟢 Deal Certifié';
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
            color,
            description: `**Opportunité réelle Vinted : -${alert.discountPercentage}% sous la cote !**\n\n🎯 **Catalogue :** \`${catalogLabel}\`\n\n${alert.anomalyReason}`,
            fields: [
              { name: '🎯 Catalogue', value: `\`${catalogLabel}\``, inline: true },
              {
                name: '💰 Prix Vendeur',
                value: alert.previousPrice
                  ? `~~${alert.previousPrice} €~~ ➔ **${alert.sellerPrice} €**`
                  : `**${alert.sellerPrice} €**`,
                inline: true,
              },
              { name: '📈 Cote Estimée', value: `**${alert.marketPrice} €**`, inline: true },
              { name: '💥 Économie', value: `**-${alert.discountPercentage}%**`, inline: true },
              { name: '👤 Vendeur', value: `@${alert.sellerName}`, inline: true },
              { name: '🏷️ Marque / Taille', value: `${alert.brand || 'Vinted'} · ${alert.size || 'Standard'}`, inline: true },
              { name: '🛒 Lien Canonique', value: `[Ouvrir l'annonce (${alert.id})](${canonicalItemUrl})`, inline: true },
            ],
            thumbnail: alert.imageUrl ? { url: alert.imageUrl } : undefined,
            footer: { text: `Vinted Pro Suite · Netlify Serverless` },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    if (!payload) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Aucun contenu ou alerte à envoyer' }),
      };
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      return {
        statusCode: discordRes.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Discord webhook rejected: ${errText}` }),
      };
    }

    if (alert && alert.id) {
      sentDiscordItemIds.add(String(alert.id));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Embed Discord envoyé avec succès !' }),
    };
  } catch (err: any) {
    console.error('Netlify webhook send error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Erreur lors de l’envoi sur Discord' }),
    };
  }
};
