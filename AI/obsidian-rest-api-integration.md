# Obsidian REST API Integration Guide

## Overview
This document covers how to use the Obsidian Local REST API with curl MCP for bibliography plugin development acceleration.

## Prerequisites
- Obsidian Local REST API plugin installed and enabled
- API key generated from Obsidian REST API settings
- curl MCP server configured (`@mcp-get-community/server-curl`)

## 1. Curl MCP Usage

### Server Configuration
The curl MCP server must be configured in your Claude settings:
```json
{
  "@mcp-get-community/server-curl": {
    "runtime": "node",
    "command": "npx",
    "args": [
      "-y",
      "@mcp-get-community/server-curl"
    ]
  }
}
```

### API Call Format
Use the curl MCP server with this format:
```
mcp___mcp-get-community_server-curl__curl
```

## 2. Obsidian REST API Authentication

### API Key
- **Key**: `7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f`
- **Format**: Bearer token in Authorization header
- **Location**: Obsidian Settings → Community Plugins → REST API → API Key

### Authentication Header
```http
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

## 3. API Server Connection

### Default Configuration
- **Host**: `127.0.0.1` (localhost)
- **Port**: `27123`
- **Base URL**: `http://127.0.0.1:27123/`

### Connection Test
```bash
GET http://127.0.0.1:27123/
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Expected Response
```json
{
  "status": "OK",
  "manifest": {
    "id": "obsidian-local-rest-api",
    "name": "Local REST API",
    "version": "3.2.0",
    "minAppVersion": "0.12.0",
    "description": "Get, change or otherwise interact with your notes in Obsidian via a REST API.",
    "author": "Adam Coddington",
    "authorUrl": "https://coddingtonbear.net/",
    "isDesktopOnly": true,
    "dir": ".obsidian/plugins/obsidian-local-rest-api"
  },
  "service": "Obsidian Local REST API",
  "authenticated": true
}
```

## 4. Getting Available Commands

### Commands Endpoint
```http
GET http://127.0.0.1:27123/commands
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Complete Command List
The API returns a comprehensive list of all available Obsidian commands including:
- Core Obsidian commands (editor, workspace, file operations)
- Plugin-specific commands
- Bibliography manager commands

### Bibliography Manager Commands
- `bibliography-manager:generate-citekey` - Generate citekey for current source
- `bibliography-manager:export-bibliography-manual` - Export bibliography manually
- `bibliography-manager:import-source` - Import new source (opens DOI dialog)
- `bibliography-manager:test-doi-basic` - Test basic DOI functionality
- `bibliography-manager:test-doi-formats` - Test different DOI formats
- `bibliography-manager:test-doi-error-handling` - Test DOI error handling
- `bibliography-manager:test-doi-output-formats` - Test citation output formats
- `bibliography-manager:test-doi-comprehensive` - Run comprehensive DOI test suite
- `bibliography-manager:open-doi-test-modal` - Open interactive test modal
- `bibliography-manager:show-sources-folder` - Show sources folder
- `bibliography-manager:generate-bibliography-file` - Generate bibliography file

## 5. Command Execution

### Execute Commands
```http
POST http://127.0.0.1:27123/commands/{command-id}
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Important: Status Code Behavior
**Critical Note**: Commands only return HTTP status codes, not the actual results!

#### Expected Status Codes:
- `204 No Content` - Command executed successfully
- `200 OK` - Command executed with data response (rare)
- `404 Not Found` - Command not found
- `401 Unauthorized` - Invalid API key

#### What This Means:
- Commands **execute successfully** but **don't return plugin results**
- UI-based commands (like DOI import) will open dialogs modals
- File creation happens in Obsidian, but API doesn't return file contents
- Commands trigger functionality but require user interaction for completion

## 6. API Specification Reference

### Complete API Documentation
All endpoints, methods, and parameters are documented in:
**File**: `rest-api.yaml`
**Location**: `AI/rest-api.yaml`

### Key Endpoints Include:
- `GET /` - Server status and authentication check
- `GET /commands` - List all available commands
- `POST /commands/{command-id}` - Execute specific command
- `GET /active` - Get current active file information
- `GET /vault/` - List vault contents
- `GET /vault/{path}` - Read specific file
- `PUT /vault/{path}` - Create/update file
- `DELETE /vault/{path}` - Delete file

## 7. Practical Usage Examples

### Test API Connection
```http
GET http://127.0.0.1:27123/
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Import Source (Opens DOI Dialog)
```http
POST http://127.0.0.1:27123/commands/bibliography-manager:import-source
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Generate Bibliography File
```http
POST http://127.0.0.1:27123/commands/bibliography-manager:generate-bibliography-file
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### Run Comprehensive DOI Tests
```http
POST http://127.0.0.1:27123/commands/bibliography-manager:test-doi-comprehensive
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

### List Sources Folder
```http
GET http://127.0.0.1:27123/vault/sources/
Authorization: Bearer 7f61aa30ac8a7e6546778bbc5521bfaae474c845bf524d2fa84ae5a604dc758f
```

## 8. Troubleshooting

### Connection Issues
- **ECONNREFUSED**: Obsidian REST API plugin not enabled or server not running
- **401 Unauthorized**: Invalid API key
- **404 Not Found**: Invalid endpoint or command

### Plugin Integration
- Commands execute but require UI interaction for completion
- File creation happens in Obsidian UI, not via API response
- Use vault endpoints to verify file creation after command execution

### API Limitations
- Commands return status codes only, not execution results
- UI-dependent commands require manual completion
- No direct return of created/modified file contents

## 9. Plugin Development Acceleration

### Use Cases for Bibliography Plugin
1. **Automated Testing**: Run DOI test suites programmatically
2. **Workflow Automation**: Chain multiple bibliography commands
3. **Integration Testing**: Verify plugin response to external API calls
4. **Debugging**: Test individual functions without manual UI navigation

### Development Workflow
1. Execute commands via API to trigger plugin functionality
2. Verify results by checking vault contents via API
3. Iterate development cycle with automated command execution
4. Use API for comprehensive testing of plugin features

---
*Generated: 2025-10-19*
*Purpose: Bibliography plugin development acceleration documentation*