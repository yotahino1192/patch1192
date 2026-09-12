import Link from 'next/link';
import { legalDocuments, legalKinds, type LegalKind } from '../../lib/public-pages/content';
import { DocumentBody, PublicationNotice } from './document-body';
import styles from './public-pages.module.css';

export function PublicDocument({ kind }: { kind: LegalKind }) {
  const document = legalDocuments[kind];
  return <div className={styles.page}>
    <a className={styles.skip} href="#public-main">本文へスキップ</a>
    <header className={styles.header}>
      <Link prefetch={false} className={styles.brand} href="/" aria-label="Patch アプリへ">Patch<span aria-hidden="true"> / </span><span className={styles.brandSub}>Help &amp; Legal</span></Link>
      <nav aria-label="公開ページ"><ul>{legalKinds.map(item => <li key={item}><a href={`/${item}`} aria-current={item === kind ? 'page' : undefined}>{legalDocuments[item].label}</a></li>)}</ul></nav>
    </header>
    <main id="public-main" tabIndex={-1} className={styles.main}>
      <div className={styles.introduction}><p className={styles.eyebrow}>PATCH / {document.label.toUpperCase()}</p><h1>{document.title}</h1><p className={styles.lead}>{document.intro}</p><PublicationNotice classes={styles}/></div>
      <div className={styles.columns}>
        <nav className={styles.contents} aria-label="このページの目次"><p>このページの内容</p><ol>{document.sections.map(section => <li key={section.id}><a href={`#${kind}-${section.id}`}>{section.title}</a></li>)}</ol></nav>
        <article aria-label={document.title}><DocumentBody kind={kind} anchorPrefix={kind} classes={styles}/></article>
      </div>
    </main>
    <footer className={styles.footer}><p>Patch / Help &amp; Legal</p><a href="#public-main">ページの先頭へ</a><Link prefetch={false} href="/">Patch アプリへ</Link></footer>
  </div>;
}
