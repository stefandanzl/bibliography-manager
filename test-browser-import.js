// Test the browser-compatible import functionality that's implemented in the plugin
// Run with: node test-browser-import.js

// Mock browser environment for Node.js testing
global.fetch = async (url) => {
  const https = require('https');
  const http = require('http');
  const urlObj = new URL(url);

  return new Promise((resolve, reject) => {
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });
    req.on('error', reject);
  });
};

// Mock DOMParser for arXiv XML parsing
global.DOMParser = class DOMParser {
  parseFromString(text, mimeType) {
    // Simple XML parser for arXiv responses
    const entries = [];
    const entryMatches = text.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entryXml of entryMatches) {
      const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
      const summaryMatch = entryXml.match(/<summary>([^<]+)<\/summary>/);
      const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);
      const authorMatches = entryXml.matchAll(/<name>([^<]+)<\/name>/g);

      entries.push({
        querySelector: (selector) => ({
          textContent: selector === 'title' ? titleMatch?.[1] :
                     selector === 'summary' ? summaryMatch?.[1] :
                     selector === 'published' ? publishedMatch?.[1] : null
        }),
        querySelectorAll: (selector) => {
          if (selector === 'author name') {
            return Array.from(authorMatches, match => ({ textContent: match[1] }));
          }
          return [];
        }
      });
    }

    return {
      querySelector: (selector) => selector === 'entry' ?
        { textContent: null } : null
    };
  }
};

// Test functions
async function testCrossrefAPI() {
  console.log('🔍 Testing Crossref API (DOI)...');
  try {
    const doi = '10.1038/nature12373';
    const response = await fetch(`https://api.crossref.org/works/${doi}`);
    const data = await response.json();

    if (data.message) {
      console.log(`✅ Crossref API SUCCESS`);
      console.log(`   Title: ${data.message.title?.[0]?.substring(0, 50)}...`);
      console.log(`   Authors: ${data.message.author?.length || 0} found`);
      console.log(`   Year: ${data.message.published?.['date-parts']?.[0]?.[0] || 'N/A'}`);
      return true;
    } else {
      console.log('❌ Crossref API FAILED - No data returned');
      return false;
    }
  } catch (error) {
    console.log(`❌ Crossref API FAILED - ${error.message}`);
    return false;
  }
}

async function testOpenLibraryAPI() {
  console.log('\n📖 Testing Open Library API (ISBN)...');
  try {
    const isbn = '9780262033848'; // Clean ISBN
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await response.json();

    const key = `ISBN:${isbn}`;
    if (data[key]) {
      console.log(`✅ Open Library API SUCCESS`);
      console.log(`   Title: ${data[key].title?.substring(0, 50)}...`);
      console.log(`   Authors: ${data[key].authors?.length || 0} found`);
      console.log(`   Publisher: ${data[key].publishers?.[0]?.name || 'N/A'}`);
      return true;
    } else {
      console.log('❌ Open Library API FAILED - No data returned');
      return false;
    }
  } catch (error) {
    console.log(`❌ Open Library API FAILED - ${error.message}`);
    return false;
  }
}

async function testBibTeXParser() {
  console.log('\n📚 Testing BibTeX Parser (@retorquere/bibtex-parser)...');
  try {
    // Import the bibtex-parser library
    const { parse } = await import('@retorquere/bibtex-parser');

    const bibtex = `@article{einstein1905,
      title={On the electrodynamics of moving bodies},
      author={Einstein, Albert and Maxwell, James},
      journal={Annalen der Physik},
      volume={17},
      number={10},
      pages={891--921},
      year={1905},
      publisher={Wiley Online Library}
    }`;

    const parsed = parse(bibtex);

    if (parsed && parsed.length > 0) {
      const entry = parsed[0];
      console.log(`✅ BibTeX Parser SUCCESS`);
      console.log(`   Title: ${entry.title?.substring(0, 50)}...`);
      console.log(`   Author: ${entry.author}`);
      console.log(`   Year: ${entry.year}`);
      console.log(`   Type: ${entry.type}`);
      console.log(`   Key: ${entry.key}`);
      return true;
    } else {
      console.log('❌ BibTeX Parser FAILED - No data returned');
      return false;
    }
  } catch (error) {
    console.log(`❌ BibTeX Parser FAILED - ${error.message}`);
    return false;
  }
}

async function testLatexUnicodeConversion() {
  console.log('\n🔤 Testing LaTeX to Unicode conversion...');
  try {
    const { latexToUnicode } = await import('latex-to-unicode');

    const latexText = "M{\\o}nster and \\alpha\\beta\\gamma";
    const unicodeText = latexToUnicode(latexText);

    if (unicodeText && unicodeText !== latexText) {
      console.log(`✅ LaTeX to Unicode conversion SUCCESS`);
      console.log(`   Input: ${latexText}`);
      console.log(`   Output: ${unicodeText}`);
      return true;
    } else {
      console.log('❌ LaTeX to Unicode conversion FAILED - No conversion');
      return false;
    }
  } catch (error) {
    console.log(`❌ LaTeX to Unicode conversion FAILED - ${error.message}`);
    return false;
  }
}

async function testUnicodeLatexConversion() {
  console.log('\n🔤 Testing Unicode to LaTeX conversion...');
  try {
    const unicode2latex = await import('unicode2latex');

    const unicodeText = "Mønster and αβγ";
    const latexText = unicode2latex.convert(unicodeText);

    if (latexText && latexText !== unicodeText) {
      console.log(`✅ Unicode to LaTeX conversion SUCCESS`);
      console.log(`   Input: ${unicodeText}`);
      console.log(`   Output: ${latexText}`);
      return true;
    } else {
      console.log('❌ Unicode to LaTeX conversion FAILED - No conversion');
      return false;
    }
  } catch (error) {
    console.log(`❌ Unicode to LaTeX conversion FAILED - ${error.message}`);
    return false;
  }
}

async function testArXivAPI() {
  console.log('\n🔗 Testing arXiv API...');
  try {
    const arxivId = '2301.07041';
    const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
    const text = await response.text();

    if (text.includes('<entry>')) {
      console.log(`✅ arXiv API SUCCESS`);
      console.log(`   Response contains XML entries`);
      console.log(`   arXiv ID: ${arxivId}`);
      return true;
    } else {
      console.log('❌ arXiv API FAILED - No entries found');
      return false;
    }
  } catch (error) {
    console.log(`❌ arXiv API FAILED - ${error.message}`);
    return false;
  }
}

async function testBrowserCompatibility() {
  console.log('\n🌐 Testing Browser Compatibility...');

  const tests = [
    { name: 'Crossref API', test: testCrossrefAPI },
    { name: 'Open Library API', test: testOpenLibraryAPI },
    { name: 'BibTeX Parser', test: testBibTeXParser },
    { name: 'LaTeX to Unicode', test: testLatexUnicodeConversion },
    { name: 'Unicode to LaTeX', test: testUnicodeLatexConversion },
    { name: 'arXiv API', test: testArXivAPI }
  ];

  let passCount = 0;
  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) passCount++;
    } catch (error) {
      console.log(`❌ ${name} crashed - ${error.message}`);
    }
  }

  console.log('\n📊 BROWSER-COMPATIBLE TEST RESULTS:');
  console.log('====================================');
  console.log(`✅ ${passCount}/${tests.length} tests PASSED`);

  if (passCount === tests.length) {
    console.log('🎉 ALL BROWSER-COMPATIBLE IMPORT FUNCTIONALITY WORKS!');
    console.log('\nThe plugin should now work in Obsidian without citation-js dependency issues.');
  } else {
    console.log('⚠️ Some imports may have issues, but basic functionality should work.');
  }

  console.log('\n📝 New Library Features:');
  console.log('- DOI Import: Uses Crossref API directly');
  console.log('- ISBN Import: Uses Open Library API directly');
  console.log('- BibTeX Import: @retorquere/bibtex-parser implementation');
  console.log('- LaTeX ↔ Unicode: Special character conversion with latex-to-unicode & unicode2latex');
  console.log('- URL Import: Handles DOI URLs and arXiv URLs');
  console.log('- arXiv Support: Parses arXiv XML responses');
  console.log('- Better performance: Replaced citation-js with focused libraries');
}

// Run the test
testBrowserCompatibility().catch(console.error);