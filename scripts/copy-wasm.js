const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "node_modules", "web-ifc", "wasm");
const destDir = path.join(__dirname, "..", "public", "wasm");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  copyDir(srcDir, destDir);
  console.log("Copied web-ifc wasm files to public/wasm");
} catch (err) {
  console.warn("Could not copy wasm files:", err);
}
