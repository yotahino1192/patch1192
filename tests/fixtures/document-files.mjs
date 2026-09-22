import { zipSync, strToU8 } from 'fflate';
// All content is synthetic. Safe to use in isolated browser/native QA; no private files.
export const fixtureText = 'Recall and practice strengthen memory. Reading material provides context, while reviewing questions helps learners remember the key ideas.';
export function pdfBytes(text = fixtureText) {
  const lines = text.match(/.{1,65}(?:\s|$)|.{1,65}/g) || [''];
  const stream = 'BT /F1 10 Tf 20 720 Td 14 TL ' + lines.map(line => `(${line.trim().replace(/[\\()]/g, '\\$&')}) Tj T*`).join(' ') + ' ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const start = pdf.length;
  return pdf + 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
}
const zip = files => zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])));
const relNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const types = entries => `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${entries.map(([name,type]) => `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>`;
export const documentFixtures = {
  pdf: pdfBytes(),
  docx: zip({
    '[Content_Types].xml': types([['word/document.xml','wordprocessingml.document.main']]),
    '_rels/.rels': `<Relationships xmlns="${relNS}"><Relationship Id="r1" Type="${officeRel}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${fixtureText}</w:t></w:r></w:p></w:body></w:document>`,
  }),
  pptx: zip({
    '[Content_Types].xml': types([['ppt/presentation.xml','presentationml.presentation.main'],['ppt/slides/slide1.xml','presentationml.slide']]),
    '_rels/.rels': `<Relationships xmlns="${relNS}"><Relationship Id="r1" Type="${officeRel}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'ppt/presentation.xml': `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${officeRel}"><p:sldIdLst><p:sldId id="256" r:id="r1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships xmlns="${relNS}"><Relationship Id="r1" Type="${officeRel}/slide" Target="slides/slide1.xml"/></Relationships>`,
    'ppt/slides/slide1.xml': `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${fixtureText}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  }),
  txt: fixtureText, md: fixtureText, csv: fixtureText,
};
export const normalizedText = text => text.replace(/\s+/g, ' ').trim();
