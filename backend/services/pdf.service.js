'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { UPLOAD_DIR } = require('../config');

const pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs');

async function extractReportSentences(storedName, maxPages = 20) {
  const { getDocument } = await pdfjs;
  const document = await getDocument({
    data: new Uint8Array(fs.readFileSync(path.join(UPLOAD_DIR, storedName))),
    verbosity: 0
  }).promise;
  const sentences = [];
  const pagesRead = Math.min(document.numPages, maxPages);
  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim();
    sentences.push(...(text.match(/(?:[^.!?]|\.(?=\d))+[.!?]?(?=\s|$)/g) || [])
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 35));
  }
  return { sentences, pagesRead, totalPages: document.numPages };
}

module.exports = {
  extractReportSentences
};
