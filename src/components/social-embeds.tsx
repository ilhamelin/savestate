'use client';
import { socialLinks } from '@/domain/social-embed';
import { SocialEmbed } from './social-embed';
export function SocialEmbeds({ content }: { content: string }) {
  return socialLinks(content).map((post) => <SocialEmbed key={post.url} url={post.url} />);
}
