export type AppModule = 'hunter' | 'bargains' | 'legit_check' | 'trends';

export interface BargainItem {
  id: string;
  title: string;
  brand: string;
  condition: string;
  size: string;
  sellerPrice: number;
  offerPrice40: number; // -40% aggressive discount
  marketPrice: number;
  estimatedNetProfit: number;
  daysUnsold: number;
  sellerActiveRecently: boolean;
  sellerName: string;
  imageUrl?: string;
  itemUrl: string;
  negotiationScript: string;
  catalogName?: string;
}

export interface VintedAlert {
  id: string;
  title: string;
  brand: string;
  category: string;
  condition: string;
  sellerPrice: number;
  previousPrice?: number;
  marketPrice: number;
  discountPercentage: number;
  sellerName: string;
  sellerRating: number;
  sellerReviewsCount: number;
  isCertified: boolean;
  alertType: 'certified' | 'manual' | 'price_drop';
  detectedAt: Date | string | number;
  size: string;
  imageThumbnail: string;
  imageUrl?: string;
  itemUrl?: string;
  anomalyReason: string;
  catalogName?: string;
  catalogId?: string;
}

export interface VintedCatalog {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  articlesFoundCount: number;
  lastScannedAt?: number;
  createdAt: number;
  discordWebhookUrl?: string;
}

export interface LegitCheckPoint {
  title: string;
  status: 'passed' | 'warning' | 'failed';
  comment: string;
}

export interface LegitCheckReport {
  id: string;
  brand: string;
  model: string;
  score: number; // 0 - 100
  verdict: 'AUTHENTIC' | 'SUSPICIOUS' | 'FAKE';
  verdictLabel: string;
  confidence: number;
  marketEstimate: {
    min: number;
    max: number;
    recommended: number;
  };
  checkpoints: LegitCheckPoint[];
  summary: string;
  photoPreviews: {
    overview?: string;
    collarTag?: string;
    logoDetail?: string;
    washTag?: string;
  };
  createdAt: number;
}

export interface SnipeTrendModel {
  id: string;
  name: string;
  brand: string;
  category: 'Streetwear' | 'Gorpcore' | 'Sneakers' | 'Casual Chic' | 'Luxe';
  medianPrice: number;
  priceRange: { min: number; max: number };
  targetBuyPrice: number;
  avgLikesPerDay: number;
  sellingSpeed: string; // ex: "< 24h", "< 48h", "3-5 jours"
  highRiskReplica: boolean;
  trendDirection: 'up' | 'stable' | 'hot';
  estimatedMargin: number;
  seasonality: string;
}

export interface DiscordWebhooksConfig {
  webhook1_hunter: string;
  webhook2_legitCheck: string;
  webhook3_trends: string;
  autoSendHunter: boolean;
}
