import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { zipSync, strToU8 } from 'fflate';
import { extractDocument, extractOfficeText, MAX_DOCUMENT_BYTES } from '../lib/document-import.ts';

globalThis.DOMParser = DOMParser;
const zip = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])));
test('text attachments preserve Japanese and reject oversized or empty input', async () => {
  assert.equal(await extractDocument(new File(['日本語の学習資料'], 'notes.txt')), '日本語の学習資料');
  assert.equal(await extractDocument(new File([new Uint8Array([0x82,0xa0,0x82,0xa2])], 'notes.csv')), 'あい');
  await assert.rejects(extractDocument(new File([''], 'empty.txt')), /文章を読み取れません/);
  await assert.rejects(extractDocument(new File(['a'.repeat(30001)], 'long.txt')), /30,000/);
  await assert.rejects(extractDocument({name:'big.pdf',size:MAX_DOCUMENT_BYTES+1}), /10MB/);
  await assert.rejects(extractDocument(new File(['legacy'], 'old.doc')), /docx/);
});
test('Word combines text runs, preserves paragraph breaks, and ignores unrelated archive entries', () => {
  const file = zip({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>行政</w:t></w:r><w:r><w:t>の役割 &amp; 法律</w:t></w:r></w:p><w:p><w:r><w:t>次の段落</w:t></w:r></w:p></w:body></w:document>', 'word/media/ignored.bin':'irrelevant'});
  assert.equal(extractOfficeText(file,'docx'), '行政の役割 & 法律\n次の段落');
});
test('PowerPoint reads slide text in numeric slide order', () => {
  const xml = (text) => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
  assert.equal(extractOfficeText(zip({'ppt/slides/slide10.xml':xml('十'), 'ppt/slides/slide2.xml':xml('二'), 'ppt/slides/slide1.xml':xml('一')}),'pptx'), '一\n二\n十');
});
test('documents with entities or no supported content are rejected', () => {
  assert.throws(() => extractOfficeText(zip({'word/document.xml':'<!DOCTYPE foo [<!ENTITY x "test">]><foo/>'}),'docx'), /対応していません/);
  assert.throws(() => extractOfficeText(zip({'misc.txt':'text'}),'pptx'), /形式/);
});

const pdfOptions = { workerSrc: new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).href };
function pdfFile(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File([pdf], 'lesson.pdf');
}
test('PDF extracts embedded text and reports documents with no readable text', async () => {
  assert.equal(await extractDocument(pdfFile('Learning from a PDF document'), pdfOptions), 'Learning from a PDF document');
  await assert.rejects(extractDocument(pdfFile(''), pdfOptions), /文章を読み取れません/);
});

test('PowerPoint respects reordered slides from its presentation manifest', () => {
  const xml = (text) => `<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>${text}</a:t></a:r></a:p>`;
  const files = {
    'ppt/slides/slide1.xml':xml('Second'), 'ppt/slides/slide2.xml':xml('First'),
    'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>'
  };
  assert.equal(extractOfficeText(zip(files),'pptx'),'First\nSecond');
});
