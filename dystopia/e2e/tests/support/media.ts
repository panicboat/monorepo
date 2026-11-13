import { SIGNED_IN_AS } from './act.ts';
import type { BrowserActFixtures } from './act.ts';

// Monolith signs S3 URLs for this relay (bin/stack), so served media URLs start with it.
export const RELAY_ORIGIN = 'http://127.0.0.1:9298';

export const POST_WITH_IMAGE_FOR_FOLLOWERS = `${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, tap 画像/動画を追加 and attach fixtures/post-image.png, wait until the image preview appears, turn on the フォロワーのみ switch, post it, then open the menu, choose プロフィール, and check that {body} is listed`;

// A bare element count would pass for an image whose signed URL failed to load, so only completed loads from the relay are counted.
export async function loadedMediaImages(fx: BrowserActFixtures, body: string): Promise<number> {
  return fx.browser.evaluate(
    ({ needle, origin }) =>
      Array.from(document.querySelectorAll('article'))
        .filter((article) => article.textContent?.includes(needle))
        .flatMap((article) => Array.from(article.querySelectorAll('img')))
        .filter((img) => img.src.startsWith(origin) && img.complete && img.naturalWidth > 0).length,
    { needle: body, origin: RELAY_ORIGIN },
  );
}
