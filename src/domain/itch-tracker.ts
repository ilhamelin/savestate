import { object, text, uuid, ValidationError } from './validation.ts';

export const ITCH_STATUSES = ['playing', 'waiting_update', 'completed', 'on_hold'] as const;
export type ItchStatus = (typeof ITCH_STATUSES)[number];
export interface ItchDevlog {
  title: string;
  url: string;
  publishedAt: string;
  version: string | null;
}
export interface ItchMetadata {
  id: string;
  url: string;
  title: string;
  author: string;
  coverImage: string | null;
  tags: string[];
  screenshots: string[];
  devlog: ItchDevlog | null;
  devlogAvailable: boolean;
  releaseDevlog?: ItchDevlog | null;
  downloads?: { uploadId: string; size: string | null }[];
  downloadsAvailable?: boolean;
  installerChanged?: boolean;
}
export interface ItchTracker extends Omit<ItchMetadata, 'id'> {
  id: string;
  itchId: string;
  currentPlayedVersion: string;
  latestDetectedVersion: string;
  status: ItchStatus;
  milestones: { id: string; title: string; completed: boolean }[];
  privateNotes: string;
  lastCheckedAt: string;
}
export interface ItchTrackerRow {
  id: string;
  user_id: string;
  url: string;
  metadata: ItchMetadata;
  current_played_version: string;
  status: ItchStatus;
  milestones: ItchTracker['milestones'];
  private_notes: string;
  last_checked_at: string;
}
export function itchUrl(input: unknown): string {
  const raw = text(input, 'URL de itch.io', 1000);
  if (/[\\\s]/.test(raw)) throw new ValidationError('URL de itch.io inválida.');
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !/^[a-z0-9][a-z0-9-]*\.itch\.io$/.test(url.hostname) ||
      !/^\/[a-z0-9][a-z0-9-]*\/?$/.test(url.pathname)
    )
      throw new Error();
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    throw new ValidationError('Usa la URL HTTPS del juego: https://autor.itch.io/juego.');
  }
}
function image(input: unknown): string | null {
  try {
    const url = new URL(String(input));
    return url.protocol === 'https:' &&
      url.hostname === 'img.itch.zone' &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
export function itchMetadata(
  input: unknown,
  url: string,
): Omit<ItchMetadata, 'devlog' | 'devlogAvailable'> {
  const data = object(input);
  if (!Number.isSafeInteger(data.id) || Number(data.id) <= 0)
    throw new ValidationError('itch.io no devolvió un juego válido.');
  const authors = Array.isArray(data.authors) ? data.authors : [];
  return {
    id: String(data.id),
    url,
    title: text(data.title, 'Título', 300),
    author:
      authors
        .flatMap((author) =>
          author && typeof author === 'object' && typeof author.name === 'string'
            ? [author.name.slice(0, 100)]
            : [],
        )
        .slice(0, 5)
        .join(', ') || new URL(url).hostname.split('.')[0]!,
    coverImage: image(data.cover_image),
    tags: (Array.isArray(data.tags) ? data.tags : [])
      .filter((tag): tag is string => typeof tag === 'string' && tag.length <= 80)
      .slice(0, 30),
    screenshots: (Array.isArray(data.screenshots) ? data.screenshots : [])
      .flatMap((value) => (image(value) ? [image(value)!] : []))
      .slice(0, 12),
  };
}
function xmlText(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity, key: string) => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
      if (named[key]) return named[key];
      const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : entity;
    })
    .trim();
}
export function latestItchDevlog(rss: string, gameUrl: string): ItchDevlog | null {
  return parseItchDevlogs(rss, gameUrl)[0] ?? null;
}
export function isReleaseDevlog(title: string, version: string | null): boolean {
  return (
    Boolean(version) || /(release|update|patch|hotfix|build|versión|actualización)/i.test(title)
  );
}
export function latestItchRelease(rss: string, gameUrl: string): ItchDevlog | null {
  return (
    parseItchDevlogs(rss, gameUrl).find((item) => isReleaseDevlog(item.title, item.version)) ?? null
  );
}
function parseItchDevlogs(rss: string, gameUrl: string): ItchDevlog[] {
  if (rss.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(rss) || !/<rss\b/i.test(rss))
    throw new ValidationError('Feed de itch.io inválido.');
  const items: ItchDevlog[] = [];
  for (const match of rss.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const field = (name: string) =>
      xmlText(
        new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(match[1]!)?.[1] ?? '',
      );
    const title = field('title').slice(0, 300),
      published = Date.parse(field('pubDate'));
    try {
      const link = new URL(field('link'));
      const canonical = new URL(gameUrl);
      if (
        !title ||
        !Number.isFinite(published) ||
        link.origin !== canonical.origin ||
        link.username ||
        link.password ||
        !link.pathname.startsWith(`${canonical.pathname}/devlog/`)
      )
        continue;
      link.search = '';
      link.hash = '';
      const version =
        /(?:^|[\s(:])v?(\d+\.\d+(?:\.\d+)*[a-zA-Z]?)(?=$|[\s),:!-])/i.exec(title)?.[1] ?? null;
      items.push({
        title,
        url: link.toString(),
        publishedAt: new Date(published).toISOString(),
        version,
      });
    } catch {
      /* External or invalid feed links are ignored. */
    }
  }
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
export function itchDownloads(html: string): NonNullable<ItchMetadata['downloads']> {
  if (html.length > 1000000) throw new ValidationError('Página de itch.io demasiado grande.');
  // Public download widgets follow the #download heading; never execute page scripts.
  const heading = /<[^>]+\bid\s*=\s*["']download["'][^>]*>/i.exec(html);
  if (!heading) return [];
  const section = html.slice(heading.index + heading[0].length).split(/<section\b|<h2\b/i)[0]!;
  const uploads = [...section.matchAll(/\bdata-upload_id\s*=\s*["'](\d{1,20})["']/gi)];
  const seen = new Set<string>();
  return uploads
    .flatMap((match, index) => {
      if (seen.has(match[1]!)) return [];
      seen.add(match[1]!);
      const chunk = section.slice(match.index, uploads[index + 1]?.index ?? section.length);
      const size = /class\s*=\s*["'][^"']*\bfile_size\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(
        chunk,
      )?.[1];
      const plain = size ? xmlText(size) : '';
      return [
        {
          uploadId: match[1]!,
          size: /^\d+(?:[.,]\d+)?\s*(?:bytes?|[KMGT]i?B)$/i.test(plain) ? plain : null,
        },
      ];
    })
    .slice(0, 100);
}
export function itchRelease(metadata: Pick<ItchMetadata, 'devlog' | 'releaseDevlog'>) {
  return (
    metadata.releaseDevlog ??
    (metadata.devlog && isReleaseDevlog(metadata.devlog.title, metadata.devlog.version)
      ? metadata.devlog
      : null)
  );
}
export function validateItchEdits(input: unknown) {
  const data = object(input);
  if (
    !ITCH_STATUSES.includes(data.status as ItchStatus) ||
    !Array.isArray(data.milestones) ||
    data.milestones.length > 50
  )
    throw new ValidationError('Estado o hitos inválidos.');
  const milestones = data.milestones.map((item) => {
    const milestone = object(item);
    if (typeof milestone.completed !== 'boolean') throw new ValidationError('Hito inválido.');
    return {
      id: uuid(milestone.id),
      title: text(milestone.title, 'Hito', 120),
      completed: milestone.completed,
    };
  });
  if (new Set(milestones.map((item) => item.id)).size !== milestones.length)
    throw new ValidationError('Hitos duplicados.');
  return {
    current_played_version: text(data.currentPlayedVersion, 'Versión', 80, 0),
    status: data.status as ItchStatus,
    milestones,
    private_notes: text(data.privateNotes, 'Notas', 5000, 0),
  };
}
export function trackerForDisplay(row: ItchTrackerRow): ItchTracker {
  return {
    ...row.metadata,
    id: row.id,
    itchId: row.metadata.id,
    currentPlayedVersion: row.current_played_version,
    latestDetectedVersion:
      itchRelease(row.metadata)?.version ?? itchRelease(row.metadata)?.title.slice(0, 80) ?? '',
    status: row.status,
    milestones: row.milestones,
    privateNotes: row.private_notes,
    lastCheckedAt: row.last_checked_at,
  };
}
export function itchUpdateAvailable(
  tracker: Pick<
    ItchTracker,
    | 'currentPlayedVersion'
    | 'latestDetectedVersion'
    | 'devlog'
    | 'releaseDevlog'
    | 'installerChanged'
  >,
) {
  if (tracker.installerChanged) return true;
  const release = itchRelease(tracker);
  if (!release) return false;
  const played = tracker.currentPlayedVersion.trim().replace(/^v(?=\d)/i, '');
  const latest = tracker.latestDetectedVersion.trim();
  if (!played || !latest) return false;
  if (release.version && /^\d+\.\d+(?:\.\d+)*[a-z]?$/i.test(played))
    return latest.localeCompare(played, 'en', { numeric: true, sensitivity: 'base' }) > 0;
  return latest.toLowerCase() !== played.toLowerCase();
}
