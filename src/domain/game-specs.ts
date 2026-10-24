import { metaRecord, normalizedMetaTitle } from './game-meta.ts';

export interface PcRequirementSet {
  os: string | null;
  cpu: string | null;
  ram: string | null;
  gpu: string | null;
  directx: string | null;
  storage: string | null;
}

export interface GameHardwareSpecs {
  minimum: PcRequirementSet | null;
  recommended: PcRequirementSet | null;
  isPcAvailable: boolean;
  notes?: string | null;
}

export interface CriticReviewQuote {
  quote: string;
  source: string;
  score?: string | null;
}

export type CriticRatingTier = 'positive' | 'mixed' | 'negative' | 'unknown';

export interface CriticScoreReport {
  score: number | null;
  tier: CriticRatingTier;
  provider: 'metacritic' | 'igdb' | null;
  url: string | null;
  reviewQuotes: CriticReviewQuote[];
}

export interface GameCriticAndSpecsReport {
  critic: CriticScoreReport | null;
  hardware: GameHardwareSpecs | null;
}

export function cleanHtmlText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSteamRequirements(html: string | undefined | null): PcRequirementSet | null {
  if (!html || typeof html !== 'string') return null;
  const getField = (labels: string[]): string | null => {
    for (const label of labels) {
      const regex = new RegExp(`<strong>(?:${label}):?<\\/strong>\\s*([^<\\n\\r]+)`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        const cleaned = cleanHtmlText(match[1]).replace(/^[,\s;]+|[,\s;]+$/g, '');
        if (cleaned.length > 0) return cleaned;
      }
    }
    return null;
  };

  const parsed: PcRequirementSet = {
    os: getField(['SO', 'OS']),
    cpu: getField(['Procesador', 'Processor', 'CPU']),
    ram: getField(['Memoria', 'Memory', 'RAM']),
    gpu: getField(['Gráficos', 'Graphics', 'GPU', 'Video']),
    directx: getField(['DirectX', 'Versión de DirectX']),
    storage: getField(['Almacenamiento', 'Storage', 'Disco', 'Espacio']),
  };

  const hasAnyField = Object.values(parsed).some((value) => value !== null);
  return hasAnyField ? parsed : null;
}

export function parseReviewQuotes(html: string | undefined | null): CriticReviewQuote[] {
  if (!html || typeof html !== 'string') return [];
  const fragments = html
    .split(/<br\s*\/?>\s*<br\s*\/?>|\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const results: CriticReviewQuote[] = [];

  for (const fragment of fragments) {
    if (results.length >= 3) break;
    const lines = fragment
      .split(/<br\s*\/?>|\r?\n/)
      .map(cleanHtmlText)
      .filter(Boolean);

    const firstLine = lines[0];
    const secondLine = lines[1];
    if (firstLine && secondLine) {
      const quote = firstLine.replace(/^[“"']+|[”"']+$/g, '').trim();
      const scoreMatch = secondLine.match(
        /^(\d+(?:\.\d+)?\s*\/\s*\d+|\d+%\s*|\d+\s*(?:de|\/)\s*\d+)\s*[-–—]\s*(.+)$/i,
      );
      if (scoreMatch && scoreMatch[1] && scoreMatch[2]) {
        results.push({
          quote,
          score: scoreMatch[1].trim(),
          source: scoreMatch[2].trim(),
        });
      } else {
        const parts = secondLine.split(/[-–—]/);
        const lastPart = parts[parts.length - 1];
        results.push({
          quote,
          score: null,
          source: (lastPart ?? secondLine).trim(),
        });
      }
    } else if (firstLine && firstLine.includes('–')) {
      const parts = firstLine.split(/–|-/);
      const quotePart = parts[0];
      const sourcePart = parts[1];
      if (quotePart && sourcePart) {
        results.push({
          quote: quotePart.replace(/^[“"']+|[”"']+$/g, '').trim(),
          source: sourcePart.trim(),
          score: null,
        });
      }
    }
  }

  return results;
}

export function getCriticTier(score: number | null): CriticRatingTier {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return 'unknown';
  if (score >= 75) return 'positive';
  if (score >= 50) return 'mixed';
  return 'negative';
}

export function sanitizeMetacriticUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'https:' &&
      ['www.metacritic.com', 'metacritic.com'].includes(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port
    ) {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export { metaRecord, normalizedMetaTitle };
