const IMAGE_ID = /^[a-zA-Z0-9_]+$/;
const SCREENSHOT_BASE = 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/';

/** Only construct CDN URLs from identifiers, never from upstream URL fragments. */
export function igdbScreenshotUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item: unknown) => {
        if (!item || typeof item !== 'object' || !('image_id' in item)) return [];
        const id = item.image_id;
        return typeof id === 'string' && IMAGE_ID.test(id) && id.trim() === id
          ? [SCREENSHOT_BASE + id + '.jpg']
          : [];
      }),
    ),
  ];
}

/** Keep the same strict CDN boundary when rendering cached/client catalogue data. */
export function gameScreenshotUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (url: unknown): url is string =>
          typeof url === 'string' &&
          url.startsWith(SCREENSHOT_BASE) &&
          IMAGE_ID.test(url.slice(SCREENSHOT_BASE.length, -4)) &&
          !/[\r\n]/.test(url) &&
          url.endsWith('.jpg'),
      ),
    ),
  ];
}
