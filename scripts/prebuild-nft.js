/**
 * Vercel CLI は next build 途中で middleware.js.nft.json を参照する。
 * Turbopack が未生成の場合に備え、ビルド前に空スタブを置く（postbuild では遅い）。
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");
const nftPath = path.join(serverDir, "middleware.js.nft.json");

const STUB = { version: 1, files: [] };

function main() {
  try {
    if (fs.existsSync(nftPath)) {
      console.log("[prebuild-nft] middleware.js.nft.json already exists, skipping.");
      return;
    }

    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(nftPath, `${JSON.stringify(STUB)}\n`, "utf8");
    console.log("[prebuild-nft] Wrote empty stub middleware.js.nft.json.");
  } catch (err) {
    console.error(
      "[prebuild-nft] Failed:",
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
  }
}

main();
