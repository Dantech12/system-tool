# Fix Railway Build Error

## Changes Made:
1. Updated package.json engines.node from ">=18.0.0" to ">=20.0.0"
2. Updated nixpacks.toml nixPkgs from ['nodejs-18_x', 'npm-9_x'] to ['nodejs-20_x', 'npm-10_x']

## Reason:
Node.js 18.x has reached End-Of-Life and has been removed from Railway, causing build failures.

## Next Steps:
1. Commit these changes
2. Push to GitHub
3. Railway will automatically redeploy with Node.js 20.x
