/**
 * Turbopack は middleware.js.nft.json を出さないことがあるが、
 * Vercel CLI は同ファイルを参照するため、ビルド後に補完する。
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");
const nftPath = path.join(serverDir, "middleware.js.nft.json");

function collectFilesRecursive(dir, baseDir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[fix-nft] Could not read directory ${dir}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, baseDir, out);
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, full);
      out.push(rel.split(path.sep).join("/"));
    }
  }
}

function main() {
  try {
    if (fs.existsSync(nftPath)) {
      console.log("[fix-nft] middleware.js.nft.json already exists, skipping.");
      return;
    }

    if (!fs.existsSync(serverDir)) {
      console.warn("[fix-nft] .next/server not found; nothing to do.");
      return;
    }

    const subdirs = ["edge", "middleware"];
    const files = [];
    let sawAnyDir = false;

    for (const sub of subdirs) {
      const abs = path.join(serverDir, sub);
      if (!fs.existsSync(abs)) {
        console.warn(
          `[fix-nft] ${path.join(".next", "server", sub)} not found, skipping that tree.`,
        );
        continue;
      }
      sawAnyDir = true;
      collectFilesRecursive(abs, serverDir, files);
    }

    if (!sawAnyDir) {
      console.log(
        "[fix-nft] No .next/server/edge or .next/server/middleware; exiting without writing.",
      );
      return;
    }

    const unique = [...new Set(files)].sort();
    const payload = { version: 1, files: unique };

    fs.mkdirSync(path.dirname(nftPath), { recursive: true });
    fs.writeFileSync(nftPath, `${JSON.stringify(payload)}\n`, "utf8");

    console.log(
      `[fix-nft] Wrote middleware.js.nft.json with ${unique.length} file(s).`,
    );
  } catch (err) {
    console.error("[fix-nft] Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();
