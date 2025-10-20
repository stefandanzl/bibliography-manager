# Citekey Generation Test

## Examples

### Multiple Authors
- **Input**: ["Moser, Hans", "Bauer, Anna"], 2022
- **Expected**: MoBa22
- **Logic**:
  - First author "Moser" → "Mo" (first 2 letters, capitalized)
  - Second author "Bauer" → "Ba" (first 2 letters, capitalized)
  - Result: "Mo" + "Ba" + "22" = "MoBa22"

### Single Author
- **Input**: ["Bauer, Anna"], 2022
- **Expected**: Bau22
- **Logic**:
  - Author "Bauer" → "Bau" (first 3 letters, capitalized)
  - Result: "Bau" + "22" = "Bau22"

### Edge Cases
- **Short name**: ["Li, Wei"], 2022 → Li22 (should work with 2 letters)
- **Long name**: ["Washington, George"], 2022 → Was22 (first 3 letters)

## Changes Made
- Fixed multiple authors to capitalize both initials
- Single author already worked correctly (first 3 letters capitalized)
- One author: first 3 letters + year (capitalized)
- Multiple authors: first 2 letters of first 2 authors + year (both initials capitalized)