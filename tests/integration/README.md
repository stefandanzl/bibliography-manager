# DOI Plugin Integration Tests

This directory contains comprehensive integration tests for the DOI plugin functionality, organized into interactive test commands and modal interfaces.

## Test Structure

### Test Functions (`doi-tests.ts`)

#### Core Tests
- **`testDOIBasic()`** - Tests fundamental DOI lookup functionality
- **`testDOIFormats()`** - Tests different DOI input formats (URLs, clean DOI, etc.)
- **`testDOIErrorHandling()`** - Tests error handling with invalid DOIs
- **`testDOIOutputFormats()`** - Tests citation.js output formats
- **`runAllDOITests()`** - Runs all tests in sequence

#### Test Coverage
- ✅ Valid DOI formats (clean, HTTPS URL, HTTP URL, dx.doi.org URL)
- ✅ Special DOI types (ArXiv, Books, Short DOIs)
- ✅ Error handling (invalid formats, nonexistent DOIs, malformed URLs)
- ✅ Output formats (CSL-JSON, BibTeX, HTML, Plain Text, APA/MLA styles)
- ✅ Crossref API integration with proper User-Agent
- ✅ citation.js async API pattern usage

### Test Modal (`test-modal.ts`)

Interactive modal interface for testing with:
- **One-click test execution** - Individual test buttons
- **Custom DOI testing** - Input field for testing specific DOIs
- **Visual feedback** - Progress indicators and notifications
- **Console logging** - Detailed test results and diagnostics

#### Modal Features
- 🎯 **Basic Test**: Fundamental DOI functionality
- 📋 **Format Tests**: Multiple DOI input format support
- 🛡️ **Error Handling**: Invalid input scenarios
- 📤 **Output Formats**: Citation.js formatting options
- 🚀 **Run All**: Comprehensive test suite
- 🔬 **Custom Test**: Test any specific DOI

## Available Commands

The plugin provides the following test commands:

1. **Test basic DOI functionality** - Core DOI lookup test
2. **Test different DOI formats** - Various input format testing
3. **Test DOI error handling** - Invalid input handling
4. **Test citation output formats** - Multiple citation styles
5. **Run comprehensive DOI test suite** - All tests combined
6. **Open interactive test modal** - Full testing interface

## Usage

### Command Palette
1. Press `Ctrl+P` (or `Cmd+P` on Mac)
2. Type "bibliography manager"
3. Select any test command
4. View results in developer console (`Ctrl+Shift+I`)

### Interactive Modal
1. Open "Open interactive test modal" command
2. Choose test type from visual buttons
3. Enter custom DOI for specific testing
4. Monitor progress with real-time feedback

### Console Output
All tests provide detailed console output:
- 📊 Test results and summaries
- 🔧 Diagnostic information
- ⚠️ Error details and troubleshooting
- 📄 Citation data examples

## Test Data Sources

### Known Working DOIs
- `10.1109/5.771073` - IEEE paper (primary test)
- `10.48550/arXiv.2310.12345` - ArXiv paper
- `10.1007/978-3-662-05044-8` - Book DOI
- `10/b6dnvd` - Short DOI

### Format Variations
- Clean DOI: `10.1109/5.771073`
- HTTPS URL: `https://doi.org/10.1109/5.771073`
- HTTP URL: `http://doi.org/10.1109/5.771073`
- DX URL: `https://dx.doi.org/10.1109/5.771073`

### Error Cases
- Invalid format: `invalid-doi-format`
- Nonexistent: `10.9999/9999999`
- Empty string: `""`
- Malformed URL: `https://invalid-url/xyz`

## Technical Details

### Citation.js Integration
- Uses official `Cite.async()` API pattern
- Proper Crossref User-Agent configuration
- Comprehensive format support
- Error handling for browser environments

### Crossref API
- Email-based User-Agent for better rate limits
- Network error handling
- Format validation and cleanup
- Fallback mechanisms

### Architecture
- Modular test functions
- Separate modal UI component
- Consistent error reporting
- Detailed logging and diagnostics

## Troubleshooting

### Common Issues
1. **Network Errors**: Check internet connectivity
2. **Email Configuration**: Verify Crossref email in settings
3. **Console Access**: Enable developer console (`Ctrl+Shift+I`)
4. **Plugin Reload**: Restart Obsidian after changes

### Debug Information
Tests provide diagnostic output for:
- Citation.js plugin status
- User-Agent configuration
- Network request details
- Error type and messages
- Available methods and formats

## Future Enhancements

### Planned Tests
- ISBN integration testing
- URL metadata extraction
- BibTeX import validation
- Bibliography generation testing
- Performance benchmarks

### UI Improvements
- Test result visualization
- Export test reports
- Batch testing interface
- Configuration validation