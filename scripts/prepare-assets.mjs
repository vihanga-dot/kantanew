import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "images");
const publicDir = path.join(root, "client", "public", "images");

await mkdir(publicDir, { recursive: true });

const entries = await readdir(sourceDir);
for (const entry of entries) {
  await copyFile(path.join(sourceDir, entry), path.join(publicDir, entry));
}

for (const file of ["index.html", "products.html", "about.html", "contact.html"]) {
  const filePath = path.join(root, "client", file);
  const content = await readFile(filePath, "utf8");
  await writeFile(filePath, content.replaceAll("/manus-storage/", "/images/"), "utf8");
}

const productsPath = path.join(root, "client", "public", "products.json");
const products = await readFile(productsPath, "utf8");
await writeFile(productsPath, products.replaceAll("/manus-storage/", "/images/"), "utf8");

console.log(`Prepared ${entries.length} local image assets.`);
