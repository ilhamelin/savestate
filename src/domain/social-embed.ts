export type SocialProvider = 'twitter' | 'instagram';
export interface SocialPost {
  provider: SocialProvider;
  url: string;
  frameUrl: string;
}
export function socialPost(input: unknown): SocialPost | null {
  if (typeof input !== 'string' || input.length > 2048 || /[\s\\]/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^www\./, '');
    const tweet = /^\/([a-zA-Z0-9_]{1,15})\/status\/(\d{1,25})\/?$/.exec(url.pathname);
    if ((host === 'twitter.com' || host === 'x.com') && tweet) {
      return {
        provider: 'twitter',
        url: `https://twitter.com/${tweet[1]}/status/${tweet[2]}`,
        frameUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tweet[2]}&theme=dark&dnt=true`,
      };
    }
    const instagram = /^\/(p|reel)\/([a-zA-Z0-9_-]{1,80})\/?$/.exec(url.pathname);
    if (host === 'instagram.com' && instagram) {
      const canonical = `https://www.instagram.com/${instagram[1]}/${instagram[2]}/`;
      return { provider: 'instagram', url: canonical, frameUrl: `${canonical}embed/captioned/` };
    }
  } catch {
    /* Invalid URLs never reach upstream. */
  }
  return null;
}

// Only standalone lines, outside fenced code and spoilers, become embeds.
export function socialLinks(source: string): SocialPost[] {
  const found = new Map<string, SocialPost>();
  let fence = '';
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    const marker = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    if (marker) {
      if (!fence) fence = marker[0]!;
      else if (marker[0] === fence) fence = '';
      continue;
    }
    if (fence || /^\s{4}|\t/.test(line)) continue;
    const post = socialPost(trimmed);
    if (post) found.set(post.url, post);
    if (found.size === 3) break;
  }
  return [...found.values()];
}
