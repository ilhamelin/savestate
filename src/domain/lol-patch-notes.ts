import { load } from 'cheerio';
import { newsText } from './gaming-news.ts';
export interface LolPatchListItem {
  id: string;
  version: string;
  title: string;
  publishedAt: string;
  url: string;
  slugPath: string;
  bannerUrl: string | null;
  description: string;
}
export interface PatchAbility {
  title: string;
  iconUrl: string | null;
  changes: string[];
}
export interface PatchChampion {
  name: string;
  iconUrl: string | null;
  summary: string;
  abilities: PatchAbility[];
}
export interface PatchMode {
  summary: string;
  changes: { title: string; changes: string[] }[];
}
export interface PatchSkin {
  id: string;
  title: string;
  imageUrl: string | null;
  championName: string;
}
export interface LolPatchDetail extends LolPatchListItem {
  highlightsImageUrl: string | null;
  highlightsSummary: string;
  champions: PatchChampion[];
  aramMayhem: PatchMode | null;
  aram: PatchMode | null;
  bugfixes: string[];
  skins: PatchSkin[];
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const string = (v: unknown) => (typeof v === 'string' ? v : '');
export function patchImage(value: unknown): string | null {
  try {
    const url = new URL(string(value));
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      ![
        'cmsassets.rgpub.io',
        'ddragon.leagueoflegends.com',
        'am-a.akamaihd.net',
        'images.contentstack.io',
        'assets.contentstack.io',
      ].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
function blades(html: string): Record<string, unknown>[] {
  const $ = load(html);
  const raw = $('script#__NEXT_DATA__').text();
  if (!raw) throw Error('No se encontraron los datos oficiales de Riot.');
  const data = object(JSON.parse(raw)),
    props = object(data.props),
    pageProps = object(props.pageProps),
    page = object(pageProps.page);
  return Array.isArray(page.blades) ? page.blades.map(object) : [];
}
export function patchVersion(title: string, url: string) {
  return (
    title.match(/\b(26\.\d+)\b/i)?.[1] ??
    url.match(/patch-26-(\d+)/i)?.[1]?.replace(/^/, '26.') ??
    ''
  );
}
export function parseLolPatchList(html: string): LolPatchListItem[] {
  const rows = blades(html)
    .filter((b) => b.type === 'articleCardGrid')
    .flatMap((b) => (Array.isArray(b.items) ? b.items : []));
  const output: LolPatchListItem[] = [];
  for (const value of rows) {
    const item = object(value),
      title = newsText(string(item.title)),
      rawUrl = string(object(object(item.action).payload).url);
    const published = string(item.publishedAt) || string(object(item.analytics).publishDate);
    if (/teamfight|\btft\b/i.test(title) || /teamfight-tactics/i.test(rawUrl)) continue;
    const version = patchVersion(title, rawUrl);
    if (
      !version ||
      !(published.startsWith('2026-') || /26\.\d+|patch-26-\d+/i.test(title + ' ' + rawUrl))
    )
      continue;
    try {
      const url = new URL(rawUrl, 'https://www.leagueoflegends.com');
      const path = url.pathname.match(/^\/es-es\/news\/game-updates\/([a-z0-9-]+)\/?$/i);
      if (
        url.origin !== 'https://www.leagueoflegends.com' ||
        !path ||
        url.search ||
        url.hash ||
        !Number.isFinite(Date.parse(published))
      )
        continue;
      output.push({
        id: path[1]!,
        version,
        title,
        publishedAt: new Date(published).toISOString(),
        url: url.href,
        slugPath: url.pathname,
        bannerUrl: patchImage(object(item.media).url),
        description: newsText(string(object(item.description).body)),
      });
    } catch {
      /* Untrusted article URL. */
    }
  }
  return [...new Map(output.map((p) => [p.id, p])).values()].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}
export function parseLolPatchDetail(html: string, slug: string): LolPatchDetail {
  const all = blades(html),
    mast = all.find((b) => b.type === 'articleMasthead') ?? {},
    rich = all.find((b) => b.type === 'patchNotesRichText');
  if (!rich) throw Error('Riot no publicó las secciones de este parche.');
  const $ = load(string(object(rich.richText).body));
  $('script,style').remove();
  function section(id: string, fallback: RegExp) {
    const heading = $('h2')
      .filter((_, e) => $(e).attr('id') === id || fallback.test($(e).text()))
      .first();
    const anchor = heading.parent('header').length ? heading.parent('header') : heading;
    return load(
      heading.length
        ? anchor
            .nextUntil('h2, header:has(h2)')
            .toArray()
            .map((e) => $.html(e))
            .join('')
        : '',
    );
  }
  const highlights = section('patch-patch-highlights', /platos fuertes/i),
    champions = section('patch-champions', /^Campeones$/i),
    bugs = section('patch-bugfixes-and-qol-changes', /correcci[oó]n de errores/i),
    skins = section('patch-upcoming-skins-and-chromas', /pr[oó]ximos aspectos/i);
  const championRows: PatchChampion[] = [];
  champions('.patch-change-block').each((_, e) => {
    const block = champions(e),
      abilities: PatchAbility[] = [];
    block.find('h4').each((_, h) => {
      const heading = champions(h);
      const following = heading.nextUntil('h4,hr');
      const changes = following
        .find('li')
        .add(following.filter('li'))
        .map((_, li) => newsText(champions(li).text()))
        .get()
        .filter(Boolean);
      abilities.push({
        title: newsText(heading.text()),
        iconUrl: patchImage(heading.find('img').attr('src')),
        changes,
      });
    });
    const name = newsText(block.find('h3.change-title,h3').first().text());
    if (name)
      championRows.push({
        name,
        iconUrl: patchImage(block.find('a.reference-link img,img').first().attr('src')),
        summary: newsText(block.find('blockquote').first().text()),
        abilities,
      });
  });
  function mode(id: string, fallback: RegExp): PatchMode | null {
    const s = section(id, fallback);
    if (!s.root().text().trim()) return null;
    const changes: PatchMode['changes'] = [];
    s('h3,h4,p').each((_, e) => {
      const h = s(e);
      if (h.is('p') && !h.find('strong,b').length) return;
      const next = h.nextUntil('h3,h4,p');
      const list = next
        .find('li')
        .add(next.filter('li'))
        .map((_, li) => newsText(s(li).text()))
        .get()
        .filter(Boolean);
      if (list.length) changes.push({ title: newsText(h.text()), changes: list });
    });
    if (!changes.length) {
      const list = s('li')
        .map((_, e) => newsText(s(e).text()))
        .get()
        .filter(Boolean);
      if (list.length) changes.push({ title: 'Ajustes', changes: list });
    }
    return { summary: newsText(s('blockquote').first().text()), changes };
  }
  const skinRows: PatchSkin[] = [];
  skins('.skin-box').each((i, e) => {
    const b = skins(e),
      title = newsText(b.find('.skin-title,h4').first().text());
    if (title)
      skinRows.push({
        id: slug + '-skin-' + i,
        title,
        imageUrl:
          patchImage(b.find('a.skins').attr('href')) ?? patchImage(b.find('img').attr('src')),
        championName: title.split(' ')[0] ?? title,
      });
  });
  const title = newsText(string(mast.title)),
    published = string(mast.publishDate),
    url = 'https://www.leagueoflegends.com/es-es/news/game-updates/' + slug + '/';
  return {
    id: slug,
    version: patchVersion(title, url),
    title,
    publishedAt: Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : '',
    url,
    slugPath: new URL(url).pathname,
    bannerUrl: patchImage(object(mast.banner).url),
    description: newsText(string(object(mast.description).body)),
    highlightsImageUrl: patchImage(highlights('img').first().attr('src')),
    highlightsSummary: newsText(highlights('p').first().text()),
    champions: championRows,
    aramMayhem: mode('patch-aram:-mayhem', /^ARAM:\s*(Caos|Mayhem)$/i),
    aram: mode('patch-aram', /^ARAM$/i),
    bugfixes: bugs('li')
      .map((_, e) => newsText(bugs(e).text()))
      .get()
      .filter(Boolean),
    skins: skinRows,
  };
}
export function normalizeSkinSearch(title: string) {
  const mappings: [RegExp, string][] = [
    [/de prestigio/gi, 'Prestige'],
    [/barón clásico/gi, 'Classic Baron'],
    [/de porcelana/gi, 'Porcelain'],
    [/elegid[oa] del lobo/gi, 'Chosen of the Wolf'],
    [/luna sangrienta/gi, 'Blood Moon'],
    [/flor espiritual/gi, 'Spirit Blossom'],
    [/proyecto/gi, 'PROJECT'],
    [/guardian(?:es|a) de las estrellas/gi, 'Star Guardian'],
    [/corte feérica/gi, 'Faerie Court'],
    [/empíreo/gi, 'Empyrean'],
    [/noche de sustos/gi, 'Fright Night'],
    [/reinos mecha/gi, 'Mecha Kingdoms'],
  ];
  let result = title;
  for (const [pattern, replacement] of mappings) result = result.replace(pattern, replacement);
  return result
    .replace(/\b(de|del|la|el|los|las)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export interface SkinVideo {
  videoId: string | null;
  videoTitle: string | null;
  embedUrl: string | null;
  youtubeUrl: string | null;
  searchUrl: string;
}
export function parseSpotlightVideos(
  html: string,
  title: string,
): { videoId: string; videoTitle: string } | null {
  const marker = html.indexOf('ytInitialData');
  if (marker < 0) return null;
  const start = html.indexOf('{', marker);
  let depth = 0,
    inString = false,
    escaped = false,
    end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (start < 0 || end < 0) return null;
  const rows: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    const o = object(v);
    if (o.videoRenderer) rows.push(object(o.videoRenderer));
    Object.values(o).forEach((x) => {
      if (x && typeof x === 'object') walk(x);
    });
  };
  try {
    walk(JSON.parse(html.slice(start, end)));
  } catch {
    return null;
  }
  const words = normalizeSkinSearch(title).toLowerCase().split(/\s+/).filter(Boolean),
    champion = words[0];
  return (
    rows
      .map((row) => {
        const runs = object(row.title).runs;
        const name = Array.isArray(runs) ? runs.map((r) => string(object(r).text)).join('') : '';
        const byline = object(row.ownerText ?? row.shortBylineText);
        const owners = Array.isArray(byline.runs) ? byline.runs : [];
        const official =
          owners.length === 0 ||
          owners.some((r) => string(object(r).text).toLowerCase() === 'skinspotlights');
        const id = string(row.videoId);
        return {
          videoId: id,
          videoTitle: name,
          valid:
            official &&
            /^[\w-]{11}$/.test(id) &&
            !!champion &&
            name.toLowerCase().includes(champion) &&
            /skin spotlight/i.test(name),
          score:
            words.filter((w) => name.toLowerCase().includes(w)).length -
            (/pre-release/i.test(name) ? 0.1 : 0),
        };
      })
      .filter((r) => r.valid)
      .sort((a, b) => b.score - a.score)
      .map(({ videoId, videoTitle }) => ({ videoId, videoTitle }))[0] ?? null
  );
}
