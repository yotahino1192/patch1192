import type { Metadata } from 'next';
import { legalDocuments, type LegalKind } from '../../lib/public-pages/content';
import { canIndexPublicPages, publicService } from '../../lib/public-pages/config';
export function publicPageMetadata(kind: LegalKind): Metadata {
  const document = legalDocuments[kind];
  const title = `${document.title} | ${publicService.name}`;
  const url = `${publicService.origin}/${kind}`;
  const index = canIndexPublicPages();
  return {
    title: { absolute: title }, description: document.description,
    alternates: { canonical: url },
    robots: { index, follow: index, googleBot: { index, follow: index } },
    openGraph: { title, description: document.description, url, type: 'website', locale: 'ja_JP', siteName: publicService.name, images: [] },
    twitter: { card: 'summary', title, description: document.description, images: [] },
  };
}
