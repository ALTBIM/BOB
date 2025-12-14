# IFC WebAssembly Files

This directory needs the WebAssembly files from the `web-ifc` package for IFC file parsing to work.

## Setup Instructions

After deploying to Vercel, you need to copy the WASM files from `node_modules/web-ifc/` to this directory.

### Option 1: Manual Copy (Recommended for Vercel)

1. In your local project, run:
   \`\`\`bash
   cp node_modules/web-ifc/*.wasm public/ifc/
   \`\`\`

2. Commit and push the changes:
   \`\`\`bash
   git add public/ifc/*.wasm
   git commit -m "Add IFC WASM files"
   git push
   \`\`\`

### Option 2: Build Script

Add this to your `package.json` scripts:

\`\`\`json
{
  "scripts": {
    "postinstall": "cp node_modules/web-ifc/*.wasm public/ifc/"
  }
}
\`\`\`

## Required Files

- `web-ifc.wasm`
- `web-ifc-mt.wasm`

These files are automatically generated when you install the `web-ifc` package.

## Verification

After setup, you should see:
- `public/ifc/web-ifc.wasm`
- `public/ifc/web-ifc-mt.wasm`

The IFC viewer will load these files at runtime to parse IFC files.
