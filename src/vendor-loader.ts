// This file bundles all citation-js dependencies into a separate vendor.js file
// It will be loaded dynamically when citation functionality is needed

// Import all citation-js libraries to bundle them together
import "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-doi";
import "@citation-js/plugin-isbn";
import "@citation-js/plugin-hayagriva";

// Export for dynamic loading
export const vendorLoaded = true;