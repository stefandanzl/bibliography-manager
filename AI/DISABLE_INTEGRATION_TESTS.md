# Disable Integration Tests

## Method 1: Simple Comment Out (Recommended)

To disable all integration test commands, simply comment them out in `utils/bibliographyCommands.ts`.

**Location:** `utils/bibliographyCommands.ts` lines 1304-1345

**To disable:**
1. Open `utils/bibliographyCommands.ts`
2. Find the test commands section (starts around line 1304)
3. Comment out all test commands:

```typescript
/*
// NOTE: Integration test commands - comment out to disable
		{
			id: "test-doi-basic",
			name: "Test basic DOI functionality",
			callback: () => {
				testDOIBasic(app);
			},
		},
		// ... other test commands
*/
```

## Method 2: Settings Toggle (Advanced)

I've already added the infrastructure for a settings toggle. When you're ready to use it:

1. **Settings UI:** Added "Enable Integration Tests" toggle in plugin settings
2. **Code Structure:** Commands are conditionally loaded based on `this.settings.enableIntegrationTests`
3. **Future Enhancement:** Uncomment the conditional logic in `utils/bibliographyCommands.ts`

## Current Status

✅ **Settings infrastructure added** - Toggle option available in plugin settings
✅ **Command registration updated** - Conditional loading implemented
✅ **Integration tests preserved** - All test functions moved to organized structure

🔄 **Ready to disable** - Comment out test commands in bibliographyCommands.ts

## What Gets Disabled

When integration tests are disabled, these commands will NOT appear in command palette:
- Test basic DOI functionality
- Test different DOI formats
- Test DOI error handling
- Test citation output formats
- Run comprehensive DOI test suite
- Open interactive test modal

## Core Commands Remain Active

These essential commands are NOT affected:
- Generate citekey for current source
- Export bibliography manually
- Import new source
- Show sources folder
- Generate bibliography file

## Quick Disable Command

For immediate disabling, run this in your terminal:
```bash
# This finds and comments out the test commands
cd "c:\PROJECTS\PROGRAMMIEREN\Obsidian Plugins\bibliography-manager"
sed -i '/test-doi-basic/,/open-doi-test-modal/s/^/\/\/ /' utils/bibliographyCommands.ts
```

Then rebuild:
```bash
npm run build
```

## Re-enable When Needed

To re-enable tests later:
1. Uncomment the test commands section in `utils/bibliographyCommands.ts`
2. Build the plugin: `npm run build`
3. Reload plugin in Obsidian