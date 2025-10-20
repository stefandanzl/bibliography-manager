# Development Integration Tests

## Simple One-Line Control

**To enable/disable ALL integration tests:**

Edit `main.ts` line 302:

```typescript
// Disable tests (default)
const commands = getBibliographyCommands(this.app, false);

// Enable tests (for development)
const commands = getBibliographyCommands(this.app, true);
```

## That's it!

No settings UI, no complex configuration. Just one boolean change in main.ts.

## Available When Enabled

When `true`, these commands appear in command palette:
- Test basic DOI functionality
- Test different DOI formats
- Test DOI error handling
- Test citation output formats
- Run comprehensive DOI test suite
- Open interactive test modal

## Production Ready

Default is `false`, so no testing commands appear in production.