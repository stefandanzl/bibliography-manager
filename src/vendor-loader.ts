// This file bundles all citation-js dependencies into a separate vendor.js file
// It will be loaded dynamically when citation functionality is needed

// Import all citation-js libraries to bundle them together
import core from "@citation-js/core";
import bibtex from "@citation-js/plugin-bibtex";
import doi from "@citation-js/plugin-doi";
import isbn from "@citation-js/plugin-isbn";
import hayagriva from "@citation-js/plugin-hayagriva";

// Make modules available globally for browser environments
if (typeof window !== "undefined") {
	(window as any)["@citation-js/core"] = core;
	(window as any)["@citation-js/plugin-bibtex"] = bibtex;
	(window as any)["@citation-js/plugin-doi"] = doi;
	(window as any)["@citation-js/plugin-isbn"] = isbn;
	(window as any)["@citation-js/plugin-hayagriva"] = hayagriva;
}

// Export for dynamic loading
export const vendorLoaded = true;