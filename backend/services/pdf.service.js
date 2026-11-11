'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { UPLOAD_DIR } = require('../config');

const pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs');

async function extractReportSentencesFromBuffer(buffer, maxPages = 20) {
  const { getDocument } = await pdfjs;
  const document = await getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0
  }).promise;
  const pageTexts = [];
  const pagesRead = Math.min(document.numPages, maxPages);

  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    // Preserve PDF line boundaries where pdfjs exposes them. This is important
    // for laboratory tables containing test names, values, units and ranges.
    const pageText = content.items
      .map(item => {
        const value = typeof item.str === 'string' ? item.str : '';
        return value + (item.hasEOL ? '\\n' : ' ');
      })
      .join('')
      .split('\\n')
      .map(line => line.replace(/[\\t ]+/g, ' ').trim())
      .filter(Boolean)
      .join('\\n');
    pageTexts.push(pageText);
  }

  const text = pageTexts.join('\\n\\n').trim();
  const sentences = text
    .split(/(?<=[.!?])\\s+|\\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  return { text, sentences, pagesRead, totalPages: document.numPages };
}

async function extractReportSentences(storedName, maxPages = 20) {
  return extractReportSentencesFromBuffer(fs.readFileSync(path.join(UPLOAD_DIR, storedName)), maxPages);
}

module.exports = {
  extractReportSentences,
  extractReportSentencesFromBuffer
};
