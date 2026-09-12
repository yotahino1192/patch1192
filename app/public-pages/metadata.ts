import type { Metadata } from 'next';
import { legalDocuments, type LegalKind } from '../../lib/public-pages/content';
import { canIndexPublicPages } from '../../lib/public-pages/config';
export function publicPageMetadata(kind: LegalKind): Metadata {
  const document = legalDocuments[kind];
  const title = `${document.title} | Patch`;
  const index = canIndexPublicPages();
  return {
    title: { absolute: title }, description: document.description,
    robots: { index, follow: index, googleBot: { index, follow: index } },
    openGraph: { title, description: document.description, type: 'website', locale: 'ja_JP', siteName: 'Patch', images: [] },
    twitter: { card: 'summary', title, description: document.description, images: [] },
  };
}
