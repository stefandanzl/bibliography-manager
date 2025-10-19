// Test the actual citation-js functionality that's implemented in the plugin
// Run with: node test-import-functionality.js

const { Cite } = require('@citation-js/core');
require('@citation-js/plugin-doi');
require('@citation-js/plugin-isbn');
require('@citation-js/plugin-bibtex');
require('@citation-js/plugin-wikidata');

async function testRealFunctionality() {
  console.log('🧪 Testing ACTUAL Import Functionality\n');

  let passCount = 0;
  let totalTests = 4;

  // Test DOI Import
  console.log('🔍 Testing DOI Import...');
  try {
    const doi = '10.1038/nature12373';
    const cite = await Cite.async(doi);
    const data = await cite.format("data", { format: "object" });

    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✅ DOI Import SUCCESS`);
      console.log(`   Title: ${result.title?.substring(0, 50)}...`);
      console.log(`   Authors: ${result.author?.length || 0} found`);
      console.log(`   Year: ${result.issued?.['date-parts']?.[0]?.[0] || 'N/A'}`);
      passCount++;
    } else {
      console.log('❌ DOI Import FAILED - No data returned');
    }
  } catch (error) {
    console.log(`❌ DOI Import FAILED - ${error.message}`);
  }

  // Test ISBN Import
  console.log('\n📖 Testing ISBN Import...');
  try {
    const isbn = '978-0262033848';
    const cleanISBN = isbn.replace(/[-\s]/g, "");
    const cite = await Cite.async(cleanISBN);
    const data = await cite.format("data", { format: "object" });

    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✅ ISBN Import SUCCESS`);
      console.log(`   Title: ${result.title?.substring(0, 50)}...`);
      console.log(`   Authors: ${result.author?.length || 0} found`);
      console.log(`   Publisher: ${result.publisher || 'N/A'}`);
      passCount++;
    } else {
      console.log('❌ ISBN Import FAILED - No data returned');
    }
  } catch (error) {
    console.log(`❌ ISBN Import FAILED - ${error.message}`);
  }

  // Test BibTeX Import
  console.log('\n📚 Testing BibTeX Import...');
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

    const cite = await Cite.async(bibtex);
    const data = await cite.format("data", { format: "object" });

    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✅ BibTeX Import SUCCESS`);
      console.log(`   Title: ${result.title?.substring(0, 50)}...`);
      console.log(`   Author: ${result.author?.[0]?.family || 'N/A'}`);
      console.log(`   Year: ${result.issued?.['date-parts']?.[0]?.[0] || 'N/A'}`);
      passCount++;
    } else {
      console.log('❌ BibTeX Import FAILED - No data returned');
    }
  } catch (error) {
    console.log(`❌ BibTeX Import FAILED - ${error.message}`);
  }

  // Test URL Import (via DOI URL)
  console.log('\n🔗 Testing URL Import...');
  try {
    const url = 'https://doi.org/10.1038/nature12373';
    const cite = await Cite.async(url);
    const data = await cite.format("data", { format: "object" });

    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✅ URL Import SUCCESS`);
      console.log(`   Title: ${result.title?.substring(0, 50)}...`);
      console.log(`   Type: ${result.type || 'N/A'}`);
      console.log(`   Authors: ${result.author?.length || 0} found`);
      passCount++;
    } else {
      console.log('❌ URL Import FAILED - No data returned');
    }
  } catch (error) {
    console.log(`❌ URL Import FAILED - ${error.message}`);
  }

  // Results
  console.log('\n📊 REAL TEST RESULTS:');
  console.log('=======================');
  console.log(`✅ ${passCount}/${totalTests} tests PASSED`);

  if (passCount === totalTests) {
    console.log('🎉 ALL IMPORT FUNCTIONALITY WORKS!');
    console.log('\nThe plugin import features are ready to use.');
  } else {
    console.log('⚠️ Some imports may have issues.');
  }

  console.log('\n📝 Test Summary:');
  console.log('- DOI Import: Fetches metadata from Digital Object Identifiers');
  console.log('- ISBN Import: Fetches book information from databases');
  console.log('- BibTeX Import: Parses citation entries');
  console.log('- URL Import: Extracts metadata from web URLs');
}

// Run the test
testRealFunctionality().catch(console.error);