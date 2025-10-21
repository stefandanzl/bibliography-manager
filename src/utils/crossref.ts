// @ts-ignore - citation-js doesn't have official TypeScript types
import { Cite, util } from "@citation-js/core";
import "@citation-js/plugin-doi";
import "@citation-js/plugin-isbn";
import "@citation-js/plugin-bibtex";
// Note: wikidata plugin removed to save 2.5MB bundle size

// Set User-Agent for Crossref API if email is provided
export function setCrossrefUserAgent(
	email: string,
	showNotifications: boolean = true
) {
	if (email) {
		try {
			// Try to get version - works in both Node.js and browser
			let version = "unknown";
			try {
				if (typeof require !== "undefined") {
					version = require("@citation-js/core").version;
				} else if (typeof window !== "undefined") {
					// Browser environment - try to get version from global
					version = (window as any).citationjs?.version || "unknown";
				}
			} catch (e) {
				console.warn("Could not get citation-js version:", e);
			}

			// Set User-Agent - util should be available from @citation-js/core
			const userAgent = `Bibliography-Manager-Obsidian-Plugin (mailto:${email}) Citation.js/${version}`;
			if (typeof util !== "undefined") {
				util.setUserAgent(userAgent);
				console.log("User-Agent set:", userAgent);
			} else {
				console.warn(
					"citation-js util not available, User-Agent not set"
				);
			}
		} catch (error) {
			console.error("Failed to set User-Agent:", error);
		}
	} else if (showNotifications) {
		// Show notification that no email is provided
		if (typeof window !== "undefined" && (window as any).app) {
			// Obsidian environment
			const { Notice } = require("obsidian");
			new Notice(
				"No Crossref email provided. DOI lookups may have lower rate limits. Add your email in plugin settings for better performance.",
				8000
			);
		}
		console.warn(
			"No Crossref email provided. Add your email in plugin settings for better API rate limits."
		);
	}
}
