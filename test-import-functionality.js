// Test the new bibtex-import functionality
// Run with: node test-import-functionality.js

// Import the new libraries - these are ES modules, so we need to use dynamic imports
async function loadLibraries() {
  const bibtexParser = await import('@retorquere/bibtex-parser');
  const latexToUnicodeModule = await import('latex-to-unicode');
  const unicode2latexModule = await import('unicode2latex');

  return {
    parse: bibtexParser.parse,
    latexToUnicode: latexToUnicodeModule.default || latexToUnicodeModule.latexToUnicode,
    unicode2latex: unicode2latexModule.default || unicode2latexModule.convert
  };
}

async function testNewFunctionality() {
  console.log('🧪 Testing NEW Import Functionality\n');

  const libs = await loadLibraries();
  let passCount = 0;
  let totalTests = 5;

  // Test LaTeX to Unicode conversion
  console.log('🔤 Testing LaTeX to Unicode conversion...');
  try {
    const latexText = "M{\\o}nster and \\alpha\\beta\\gamma";
    const unicodeText = typeof libs.latexToUnicode === 'function'
      ? libs.latexToUnicode(latexText)
      : latexText;

    if (unicodeText && unicodeText !== latexText) {
      console.log(`✅ LaTeX to Unicode conversion SUCCESS`);
      console.log(`   Input: ${latexText}`);
      console.log(`   Output: ${unicodeText}`);
      passCount++;
    } else {
      console.log('❌ LaTeX to Unicode conversion FAILED - No conversion');
    }
  } catch (error) {
    console.log(`❌ LaTeX to Unicode conversion FAILED - ${error.message}`);
  }

  // Test Unicode to LaTeX conversion
  console.log('\n🔤 Testing Unicode to LaTeX conversion...');
  try {
    const unicodeText = "Mønster and αβγ";
    const latexText = typeof libs.unicode2latex === 'function'
      ? libs.unicode2latex(unicodeText)
      : libs.unicode2latex.convert ? libs.unicode2latex.convert(unicodeText) : unicodeText;

    if (latexText && latexText !== unicodeText) {
      console.log(`✅ Unicode to LaTeX conversion SUCCESS`);
      console.log(`   Input: ${unicodeText}`);
      console.log(`   Output: ${latexText}`);
      passCount++;
    } else {
      console.log('❌ Unicode to LaTeX conversion FAILED - No conversion');
    }
  } catch (error) {
    console.log(`❌ Unicode to LaTeX conversion FAILED - ${error.message}`);
  }

  // Test BibTeX parsing
  console.log('\n📚 Testing BibTeX parsing...');
  try {
    const bibtex = `@article{einstein1905,
      title={On the electrodynamics of moving bodies},
      author={Einstein, Albert},
      journal={Annalen der Physik},
      volume={17},
      number={10},
      pages={891--921},
      year={1905},
      publisher={Wiley Online Library}
    }`;

    const parsed = libs.parse(bibtex);

    if (parsed && parsed.length > 0) {
      const entry = parsed[0];
      console.log(`✅ BibTeX parsing SUCCESS`);
      console.log(`   Title: ${entry.title?.substring(0, 50)}...`);
      console.log(`   Author: ${entry.author}`);
      console.log(`   Year: ${entry.year}`);
      console.log(`   Type: ${entry.type}`);
      passCount++;
    } else {
      console.log('❌ BibTeX parsing FAILED - No data returned');
    }
  } catch (error) {
    console.log(`❌ BibTeX parsing FAILED - ${error.message}`);
  }

  // Test DOI import via Crossref API
  console.log('\n🔍 Testing DOI import (Crossref API)...');
  try {
    const doi = '10.1038/nature12373';
    const cleanDOI = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`);

    if (response.ok) {
      const data = await response.json();
      if (data.message) {
        const result = data.message;
        console.log(`✅ DOI import SUCCESS`);
        console.log(`   Title: ${result.title?.[0]?.substring(0, 50)}...`);
        console.log(`   Authors: ${result.author?.length || 0} found`);
        console.log(`   Year: ${result.published?.['date-parts']?.[0]?.[0] || 'N/A'}`);
        passCount++;
      } else {
        console.log('❌ DOI import FAILED - No data in response');
      }
    } else {
      console.log(`❌ DOI import FAILED - HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ DOI import FAILED - ${error.message}`);
  }

  // Test ISBN import via Open Library API
  console.log('\n📖 Testing ISBN import (Open Library API)...');
  try {
    const isbn = '978-0-262-03384-8';
    const cleanISBN = isbn.replace(/[-\s]/g, "");

    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`);

    if (response.ok) {
      const data = await response.json();
      const bookKey = `ISBN:${cleanISBN}`;

      if (data[bookKey]) {
        const result = data[bookKey];
        console.log(`✅ ISBN import SUCCESS`);
        console.log(`   Title: ${result.title?.substring(0, 50)}...`);
        console.log(`   Authors: ${result.authors?.length || 0} found`);
        console.log(`   Publisher: ${result.publishers?.[0]?.name || 'N/A'}`);
        passCount++;
      } else {
        console.log('❌ ISBN import FAILED - No data returned');
      }
    } else {
      console.log(`❌ ISBN import FAILED - HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ ISBN import FAILED - ${error.message}`);
  }

  // Results
  console.log('\n📊 NEW LIBRARY TEST RESULTS:');
  console.log('=============================');
  console.log(`✅ ${passCount}/${totalTests} tests PASSED`);

  if (passCount === totalTests) {
    console.log('🎉 ALL NEW FUNCTIONALITY WORKS!');
    console.log('\nThe new libraries are ready to replace citation-js.');
  } else {
    console.log('⚠️ Some functionality may have issues.');
  }

  console.log('\n📝 Test Summary:');
  console.log('- LaTeX ↔ Unicode conversion: Special character handling');
  console.log('- BibTeX parsing: Parse BibTeX entries to JSON');
  console.log('- DOI import: Fetch metadata from Crossref API');
  console.log('- ISBN import: Fetch book info from Open Library API');
}

// Run the test
testNewFunctionality().catch(console.error);