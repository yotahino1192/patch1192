import { legalDocuments, type LegalKind } from '../../lib/public-pages/content';
import { contactHref, legalFieldLabels, publicLegalConfig, type LegalField } from '../../lib/public-pages/config';
type Classes = Partial<Record<'notice' | 'fields' | 'pending' | 'body' | 'section' | 'references', string>>;

export function PublicationNotice({ classes: styles = {} }: { classes?: Classes } = {}) {
  return <aside style={styles.notice ? undefined : {margin: "20px 0", padding: 12, border: "1px solid currentColor", borderRadius: 8}} className={styles.notice} aria-label="公開状況"><strong>公開準備版</strong><p>運営者情報・保持期間・正式な法的条件には未確定の項目があります。未確定事項は本文中に明示しています。</p></aside>;
}
function LegalFields({ fields, classes: styles = {} }: { fields: readonly LegalField[]; classes?: Classes }) {
  return <dl className={styles.fields} style={styles.fields ? undefined : {marginBottom: 20}}>{fields.map(key => {
    const value = publicLegalConfig.fields[key];
    const href = key === 'contactEmail' ? contactHref() : undefined;
    return <div key={key} data-legal-field={key}><dt style={styles.fields ? undefined : {fontWeight: 700}}>{legalFieldLabels[key]}</dt><dd>{href ? <a href={href}>{value}</a> : value?.trim() || <span className={styles.pending}>未確定（公開前に設定）</span>}</dd></div>;
  })}</dl>;
}
/** No routing, auth, browser storage or Next APIs: can also be rendered inside Capacitor. */
export function DocumentBody({ kind, headingLevel = 2, anchorPrefix, classes: styles = {} }: { kind: LegalKind; headingLevel?: 2 | 3; anchorPrefix?: string; classes?: Classes }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <div className={styles.body}>{legalDocuments[kind].sections.map(section => <section key={section.id} className={styles.section} style={styles.section ? undefined : {marginBottom: 28}}>
    <Heading style={styles.section ? undefined : {fontSize: 18, lineHeight: 1.6}} id={anchorPrefix ? `${anchorPrefix}-${section.id}` : undefined}>{section.title}</Heading>
    {section.paragraphs.map(p => <p key={p}>{p}</p>)}
    {section.bullets && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
    {section.fields && <LegalFields fields={section.fields} classes={styles}/>}
    {section.links && <ul className={styles.references}>{section.links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>}
  </section>)}</div>;
}
