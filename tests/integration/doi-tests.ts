import { App } from "obsidian";
import { setCrossrefUserAgent } from "../../src/utils/crossref";

// @ts-ignore - citation-js doesn't have official TypeScript types
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-doi";

/**
 * Quick DOI lookup function that can be called directly
 */
async function quickDOILookup(doi: string): Promise<any> {
	try {
		const citation = await Cite.async(doi);
		return citation.data;
	} catch (error) {
		console.error("Quick DOI lookup failed:", error);
		throw error;
	}
}

/**
 * Basic DOI functionality test
 */
export async function testDOIBasic(app: App): Promise<void> {
	const { Notice } = require("obsidian");

	// Get plugin settings to use actual Crossref email
	const plugin = (app as any).plugins.plugins["bibliography-manager"];
	const email = plugin?.settings?.crossrefEmail || "test@example.com";

	// Set User-Agent with actual plugin email
	setCrossrefUserAgent(email, true);

	const testDOI = "10.1109/5.771073"; // A well-known IEEE paper DOI

	console.log("🔍 Testing basic DOI plugin functionality...");
	console.log(`Test DOI: ${testDOI}`);
	console.log(`Using email: ${email}`);

	try {
		// Test basic DOI lookup using official async API
		console.log("📡 Attempting DOI lookup with Cite.async()...");
		const citation = await Cite.async(testDOI);

		// Test basic data retrieval
		console.log("📊 Retrieving CSL-JSON data...");
		const data = citation.data;

		console.log("✅ DOI plugin basic test successful!");
		console.log(`📋 Retrieved ${data.length} citation(s)`);

		// Show basic information about the first citation
		if (data && data.length > 0) {
			const citationData = data[0];
			console.log("\n📄 Citation Details:");
			console.log(`   Title: ${citationData.title || "No title"}`);
			console.log(
				`   Authors: ${
					citationData.author
						?.map((a: any) => `${a.family} ${a.given}`)
						.join(", ") || "No authors"
				}`
			);
			console.log(
				`   Year: ${
					citationData.issued?.["date-parts"]?.[0]?.[0] || "No year"
				}`
			);
			console.log(`   DOI: ${citationData.DOI || "No DOI"}`);
			console.log(`   Type: ${citationData.type || "Unknown type"}`);
			console.log(
				`   Publisher: ${citationData.publisher || "No publisher"}`
			);

			// Show success notification
			new Notice(
				`✅ DOI plugin working!\nRetrieved: ${
					citationData.title || "Unknown title"
				}`,
				5000
			);
		} else {
			console.warn("⚠️ No citation data returned");
			new Notice("⚠️ DOI lookup succeeded but returned no data", 3000);
		}
	} catch (error) {
		console.error("❌ DOI plugin test failed:", error);
		new Notice(
			`❌ DOI plugin test failed:\n${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			8000
		);

		// Show additional diagnostic information
		console.log("\n🔧 Diagnostic Information:");
		console.log(
			"   - DOI plugin should be installed via @citation-js/plugin-doi"
		);
		console.log("   - Crossref API requires proper User-Agent header");
		console.log("   - Network connectivity required for DOI lookup");
		console.log("   - Some DOIs may not be available in Crossref database");
		console.log(
			"   - Using Cite.async() API pattern for better browser compatibility"
		);
		console.log(`   - Using email: ${email}`);
	}
}

/**
 * Comprehensive DOI format testing with multiple test cases
 */
export async function testDOIFormats(app: App): Promise<void> {
	const { Notice } = require("obsidian");

	// Get plugin settings to use actual Crossref email
	const plugin = (app as any).plugins.plugins["bibliography-manager"];
	const email = plugin?.settings?.crossrefEmail || "test@example.com";

	// Set User-Agent with actual plugin email
	setCrossrefUserAgent(email, true);

	console.log("🧪 Testing different DOI formats...");

	const testCases = [
		{
			name: "Clean DOI",
			doi: "10.1109/5.771073",
			description: "Standard DOI format",
		},
		{
			name: "ArXiv DOI",
			doi: "10.48550/arXiv.2310.12345",
			description: "ArXiv paper DOI format",
		},
		{
			name: "Book DOI",
			doi: "10.1007/978-3-662-05044-8",
			description: "Book DOI format",
		},
		{
			name: "Short DOI",
			doi: "10/b6dnvd",
			description: "Short DOI format",
		},
	];

	const results: Record<
		string,
		{ success: boolean; message: string; data?: any }
	> = {};

	for (const testCase of testCases) {
		console.log(`\n🔍 Testing: ${testCase.name} (${testCase.description})`);
		try {
			const data = await quickDOILookup(testCase.doi);
			results[testCase.name] = {
				success: true,
				message: "Success",
				data: data,
			};
			console.log(`   ✅ ${testCase.name}: Working`);
		} catch (error) {
			results[testCase.name] = {
				success: false,
				message:
					error instanceof Error ? error.message : "Unknown error",
			};
			console.log(
				`   ❌ ${testCase.name}: Failed - ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Show summary
	const successCount = Object.values(results).filter((r) => r.success).length;
	const totalCount = Object.keys(results).length;

	console.log(
		`\n📊 DOI Format Test Summary: ${successCount}/${totalCount} formats working`
	);

	// Show notification with summary
	new Notice(
		`DOI Format Tests: ${successCount}/${totalCount} passed\n` +
			`Check console for detailed results`,
		4000
	);

	// Log detailed results
	console.log("\n📋 Detailed Results:");
	Object.entries(results).forEach(([name, result]) => {
		console.log(
			`   ${name}: ${result.success ? "✅" : "❌"} ${result.message}`
		);
		if (result.success && result.data && result.data.length > 0) {
			console.log(`      Title: ${result.data[0].title || "No title"}`);
			console.log(
				`      Authors: ${
					result.data[0].author
						?.slice(0, 2)
						.map((a: any) => `${a.family}`)
						.join(" & ") || "No authors"
				}`
			);
			console.log(
				`      Year: ${
					result.data[0].issued?.["date-parts"]?.[0]?.[0] || "No year"
				}`
			);
		}
	});
}

/**
 * Test error handling with invalid DOIs
 */
export async function testDOIErrorHandling(app: App): Promise<void> {
	const { Notice } = require("obsidian");

	// Get plugin settings to use actual Crossref email
	const plugin = (app as any).plugins.plugins["bibliography-manager"];
	const email = plugin?.settings?.crossrefEmail || "test@example.com";

	setCrossrefUserAgent(email, false); // No notifications for error tests

	console.log("🛡️ Testing DOI error handling...");

	const invalidCases = [
		{
			name: "Invalid Format",
			doi: "invalid-doi-format",
			description: "Malformed DOI",
		},
		{
			name: "Nonexistent DOI",
			doi: "10.9999/9999999",
			description: "DOI that doesn't exist",
		},
		{
			name: "Empty String",
			doi: "",
			description: "Empty DOI input",
		},
		{
			name: "Random Text",
			doi: "some random text",
			description: "Non-DOI text",
		},
		{
			name: "Malformed URL",
			doi: "https://invalid-url/xyz",
			description: "Invalid URL format",
		},
	];

	const results: Record<
		string,
		{ success: boolean; errorType?: string; message?: string }
	> = {};

	for (const testCase of invalidCases) {
		console.log(`\n🔍 Testing: ${testCase.name} (${testCase.description})`);
		try {
			const data = await quickDOILookup(testCase.doi);
			// If we get here, the test "succeeded" unexpectedly
			results[testCase.name] = {
				success: true,
				message: "Unexpected success - should have failed",
			};
			console.log(`   ⚠️ ${testCase.name}: Unexpected success`);
		} catch (error) {
			results[testCase.name] = {
				success: false,
				errorType: error.constructor.name,
				message:
					error instanceof Error ? error.message : "Unknown error",
			};
			console.log(
				`   ✅ ${testCase.name}: Properly failed - ${error.constructor.name}`
			);
		}
	}

	// Show summary
	const properlyFailedCount = Object.values(results).filter(
		(r) => !r.success
	).length;
	const totalCount = Object.keys(results).length;

	console.log(
		`\n📊 Error Handling Test Summary: ${properlyFailedCount}/${totalCount} invalid inputs properly rejected`
	);

	new Notice(
		`DOI Error Tests: ${properlyFailedCount}/${totalCount} handled correctly`,
		3000
	);
}

/**
 * Test citation.js output formats with DOI data
 */
export async function testDOIOutputFormats(app: App): Promise<void> {
	const { Notice } = require("obsidian");

	// Get plugin settings to use actual Crossref email
	const plugin = (app as any).plugins.plugins["bibliography-manager"];
	const email = plugin?.settings?.crossrefEmail || "test@example.com";

	setCrossrefUserAgent(email, false);

	console.log("📤 Testing citation.js output formats...");

	const testDOI = "10.1109/5.771073";

	try {
		console.log("📡 Getting citation data...");
		const citation = await Cite.async(testDOI);

		if (!citation.data || citation.data.length === 0) {
			throw new Error("No citation data retrieved");
		}

		console.log(
			`\n📊 Testing output formats for: ${
				citation.data[0].title || "Unknown title"
			}`
		);

		const testFormats = [
			{ name: "CSL-JSON", method: () => citation.data },
			{ name: "BibTeX", method: () => citation.format("bibtex") },
			{
				name: "HTML (APA)",
				method: () => citation.format("html", { style: "apa" }),
			},
			{
				name: "Plain Text (APA)",
				method: () => citation.format("text", { style: "apa" }),
			},
			{
				name: "HTML (MLA)",
				method: () => citation.format("html", { style: "mla" }),
			},
			{
				name: "Plain Text (MLA)",
				method: () => citation.format("text", { style: "mla" }),
			},
		];

		const formatResults: Record<
			string,
			{ success: boolean; output?: string; message?: string }
		> = {};

		for (const format of testFormats) {
			console.log(`\n🔍 Testing: ${format.name}`);
			try {
				const result = await format.method();
				formatResults[format.name] = {
					success: true,
					output:
						typeof result === "string"
							? result.substring(0, 100) + "..."
							: JSON.stringify(result).substring(0, 100) + "...",
				};
				console.log(`   ✅ ${format.name}: Working`);
			} catch (error) {
				formatResults[format.name] = {
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Unknown error",
				};
				console.log(
					`   ❌ ${format.name}: Failed - ${
						error instanceof Error ? error.message : "Unknown error"
					}`
				);
			}
		}

		// Show summary
		const successCount = Object.values(formatResults).filter(
			(r) => r.success
		).length;
		const totalCount = Object.keys(formatResults).length;

		console.log(
			`\n📊 Output Format Test Summary: ${successCount}/${totalCount} formats working`
		);

		new Notice(
			`Output Format Tests: ${successCount}/${totalCount} passed\n` +
				`Check console for detailed results`,
			4000
		);

		// Log detailed results
		console.log("\n📋 Detailed Results:");
		Object.entries(formatResults).forEach(([name, result]) => {
			console.log(
				`   ${name}: ${result.success ? "✅" : "❌"} ${
					result.message || result.output
				}`
			);
		});
	} catch (error) {
		console.error("❌ Output format test failed:", error);
		new Notice(
			`❌ Output format test failed:\n${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			8000
		);
	}
}

/**
 * Comprehensive test suite that runs all DOI tests
 */
export async function runAllDOITests(app: App): Promise<void> {
	const { Notice } = require("obsidian");

	console.log("🚀 Starting comprehensive DOI test suite...");
	new Notice(
		"Running comprehensive DOI test suite...\nCheck console for progress",
		3000
	);

	try {
		console.log("\n" + "=".repeat(50));
		console.log("TEST 1: Basic DOI Functionality");
		console.log("=".repeat(50));
		await testDOIBasic(app);

		console.log("\n" + "=".repeat(50));
		console.log("TEST 2: DOI Format Variations");
		console.log("=".repeat(50));
		await testDOIFormats(app);

		console.log("\n" + "=".repeat(50));
		console.log("TEST 3: Error Handling");
		console.log("=".repeat(50));
		await testDOIErrorHandling(app);

		console.log("\n" + "=".repeat(50));
		console.log("TEST 4: Output Formats");
		console.log("=".repeat(50));
		await testDOIOutputFormats(app);

		console.log("\n" + "=".repeat(50));
		console.log("🎉 ALL TESTS COMPLETED!");
		console.log("=".repeat(50));

		new Notice(
			"✅ All DOI tests completed!\nCheck console for full results",
			5000
		);
	} catch (error) {
		console.error("❌ Test suite failed:", error);
		new Notice(
			`❌ Test suite failed:\n${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			8000
		);
	}
}
