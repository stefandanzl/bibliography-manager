import { App, Modal, Setting } from "obsidian";
import {
	testDOIBasic,
	testDOIFormats,
	testDOIErrorHandling,
	testDOIOutputFormats,
	runAllDOITests
} from "./doi-tests";

/**
 * Modal for interactive DOI plugin testing
 */
export class DOITestModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "🧪 DOI Plugin Test Suite" });

		const description = contentEl.createDiv();
		description.innerHTML = `
			<p>This test suite allows you to thoroughly test the DOI plugin functionality.</p>
			<p><strong>Available tests:</strong></p>
			<ul>
				<li><strong>Basic Test:</strong> Tests fundamental DOI lookup functionality</li>
				<li><strong>Format Tests:</strong> Tests different DOI input formats (URLs, clean DOI, etc.)</li>
				<li><strong>Error Handling:</strong> Tests how the plugin handles invalid DOIs</li>
				<li><strong>Output Formats:</strong> Tests different citation output formats</li>
				<li><strong>Run All:</strong> Executes all tests in sequence</li>
			</ul>
			<p><em>Check the developer console (Ctrl+Shift+I) for detailed test results.</em></p>
		`;

		contentEl.createEl("hr");

		// Test buttons
		const buttonContainer = contentEl.createDiv({ cls: "test-button-container" });

		// Basic test button
		const basicButton = buttonContainer.createEl("button", {
			text: "🔍 Basic DOI Test",
			cls: "test-button basic-test"
		});
		basicButton.onclick = () => {
			this.runTest("Basic DOI Test", testDOIBasic);
		};

		// Format tests button
		const formatButton = buttonContainer.createEl("button", {
			text: "📋 DOI Format Tests",
			cls: "test-button format-test"
		});
		formatButton.onclick = () => {
			this.runTest("DOI Format Tests", testDOIFormats);
		};

		// Error handling button
		const errorButton = buttonContainer.createEl("button", {
			text: "🛡️ Error Handling Tests",
			cls: "test-button error-test"
		});
		errorButton.onclick = () => {
			this.runTest("Error Handling Tests", testDOIErrorHandling);
		};

		// Output formats button
		const outputButton = buttonContainer.createEl("button", {
			text: "📤 Output Format Tests",
			cls: "test-button output-test"
		});
		outputButton.onclick = () => {
			this.runTest("Output Format Tests", testDOIOutputFormats);
		};

		// All tests button
		const allButton = buttonContainer.createEl("button", {
			text: "🚀 Run All Tests",
			cls: "test-button all-tests"
		});
		allButton.onclick = () => {
			this.runTest("Comprehensive Test Suite", runAllDOITests);
		};

		// Test input section
		contentEl.createEl("hr");
		contentEl.createEl("h3", { text: "🔬 Custom Test Input" });

		const customContainer = contentEl.createDiv({ cls: "custom-test-container" });

		// Custom DOI input
		new Setting(customContainer)
			.setName("Custom DOI")
			.setDesc("Enter a specific DOI to test")
			.addText(text => {
				text.setPlaceholder("10.1109/5.771073");
				text.inputEl.style.width = "100%";
			});

		// Test custom DOI button
		const customTestButton = customContainer.createEl("button", {
			text: "Test Custom DOI",
			cls: "test-button custom-test"
		});
		customTestButton.onclick = async () => {
			const doiInput = customContainer.querySelector('input') as HTMLInputElement;
			const doi = doiInput?.value.trim();

			if (!doi) {
				const { Notice } = require("obsidian");
				new Notice("Please enter a DOI to test", 3000);
				return;
			}

			this.runCustomTest("Custom DOI Test", doi);
		};

		// Add CSS styles
		this.addModalStyles();
	}

	/**
	 * Run a predefined test with loading indicator
	 */
	private async runTest(testName: string, testFunction: (app: App) => Promise<void>): Promise<void> {
		const { Notice } = require("obsidian");

		// Show starting notification
		new Notice(`🚀 Starting ${testName}...\nCheck console for progress`, 3000);

		// Disable buttons temporarily
		const buttons = this.contentEl.querySelectorAll('button');
		buttons.forEach(button => button.disabled = true);

		try {
			console.log(`\n🎯 === ${testName.toUpperCase()} ===`);
			await testFunction(this.app);
			console.log(`✅ ${testName} completed successfully`);
		} catch (error) {
			console.error(`❌ ${testName} failed:`, error);
			new Notice(`❌ ${testName} failed:\n${error instanceof Error ? error.message : "Unknown error"}`, 8000);
		} finally {
			// Re-enable buttons
			buttons.forEach(button => button.disabled = false);
		}
	}

	/**
	 * Run a custom test with user-provided DOI
	 */
	private async runCustomTest(testName: string, doi: string): Promise<void> {
		const { Notice } = require("obsidian");

		// Import required modules
		const { setCrossrefUserAgent } = require("../../utils/sourceManager");
		const { Cite } = require("@citation-js/core");
		require("@citation-js/plugin-doi");

		new Notice(`🚀 Testing custom DOI: ${doi}\nCheck console for results`, 3000);

		// Disable buttons temporarily
		const buttons = this.contentEl.querySelectorAll('button');
		buttons.forEach(button => button.disabled = true);

		try {
			console.log(`\n🎯 === CUSTOM DOI TEST ===`);
			console.log(`DOI: ${doi}`);

			// Get plugin settings for email
			const plugin = (this.app as any).plugins.plugins['bibliography-manager'];
			const email = plugin?.settings?.crossrefEmail || "test@example.com";

			// Set User-Agent
			setCrossrefUserAgent(email, false);

			// Test the DOI
			console.log("📡 Testing custom DOI...");
			const citation = await Cite.async(doi);
			const data = citation.data;

			if (data && data.length > 0) {
				const citationData = data[0];
				console.log("✅ Custom DOI test successful!");
				console.log("\n📄 Citation Details:");
				console.log(`   Title: ${citationData.title || "No title"}`);
				console.log(`   Authors: ${citationData.author?.map((a: any) => `${a.family} ${a.given}`).join(", ") || "No authors"}`);
				console.log(`   Year: ${citationData.issued?.["date-parts"]?.[0]?.[0] || "No year"}`);
				console.log(`   DOI: ${citationData.DOI || "No DOI"}`);
				console.log(`   Type: ${citationData.type || "Unknown type"}`);
				console.log(`   Publisher: ${citationData.publisher || "No publisher"}`);

				new Notice(`✅ Custom DOI successful!\nRetrieved: ${citationData.title || "Unknown title"}`, 5000);
			} else {
				console.warn("⚠️ Custom DOI test succeeded but returned no data");
				new Notice("⚠️ Custom DOI lookup succeeded but returned no data", 3000);
			}

		} catch (error) {
			console.error("❌ Custom DOI test failed:", error);
			new Notice(`❌ Custom DOI test failed:\n${error instanceof Error ? error.message : "Unknown error"}`, 8000);
		} finally {
			// Re-enable buttons
			buttons.forEach(button => button.disabled = false);
		}
	}

	/**
	 * Add CSS styles for the test modal
	 */
	private addModalStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.test-button-container {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 10px;
				margin: 20px 0;
			}

			.test-button {
				padding: 12px 16px;
				border: none;
				border-radius: 6px;
				cursor: pointer;
				font-size: 14px;
				font-weight: 500;
				transition: all 0.2s ease;
				min-height: 44px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.test-button:hover {
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			}

			.test-button:disabled {
				opacity: 0.6;
				cursor: not-allowed;
				transform: none;
				box-shadow: none;
			}

			.test-button.basic-test {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				color: white;
			}

			.test-button.format-test {
				background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
				color: white;
			}

			.test-button.error-test {
				background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
				color: #333;
			}

			.test-button.output-test {
				background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
				color: #333;
			}

			.test-button.all-tests {
				background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
				color: white;
				grid-column: 1 / -1;
			}

			.test-button.custom-test {
				background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
				color: white;
				margin-top: 10px;
			}

			.custom-test-container {
				margin: 20px 0;
				padding: 15px;
				background: var(--background-secondary);
				border-radius: 8px;
			}

			.test-button-container .setting-item {
				margin: 0;
				padding: 0;
			}

			.test-button-container .setting-item-info {
				margin-bottom: 8px;
			}

			.test-button-container .setting-item-control {
				width: 100%;
			}
		`;
		document.head.appendChild(style);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// Remove added styles
		const styles = document.querySelectorAll('style');
		styles.forEach(style => {
			if (style.textContent?.includes('test-button')) {
				style.remove();
			}
		});
	}
}