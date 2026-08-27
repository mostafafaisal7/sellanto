/**
 * Where a post actually lands, per platform, in each platform's own words.
 *
 * Meta's vocabulary differs by surface: a Facebook post goes to a *Page*, an
 * Instagram post to an *account*, LinkedIn to a *profile*, YouTube to a
 * *channel*. Help text that says "your Facebook account" is wrong in the terms
 * the user (and an App Review reviewer) would recognise, so this maps each
 * platform to the destination it really publishes to.
 */
import { platformNames } from '../components/ui';

const PUBLISH_DESTINATION: Record<string, string> = {
  facebook: 'your Facebook Page',
  instagram: 'your Instagram account',
  twitter: 'your X (Twitter) account',
  linkedin: 'your LinkedIn profile',
  tiktok: 'your TikTok account',
  youtube: 'your YouTube channel',
  pinterest: 'your Pinterest boards',
  telegram: 'your Telegram channel',
  google_business: 'your Google Business profile',
  threads: 'your Threads account',
};

/** One platform's destination, e.g. "your Instagram account". */
export function destinationFor(platform: string): string {
  return PUBLISH_DESTINATION[platform] || `your ${platformNames[platform] || platform} account`;
}

/**
 * Join destinations into a readable phrase:
 *   []                        -> ''
 *   ['instagram']             -> 'your Instagram account'
 *   ['facebook','instagram']  -> 'your Facebook Page and your Instagram account'
 *   three or more             -> 'a, b and c'
 */
export function describeDestinations(platforms: string[]): string {
  const named = platforms.map(destinationFor);
  if (named.length === 0) return '';
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}
