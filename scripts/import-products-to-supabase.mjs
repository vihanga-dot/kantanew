import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "client", "public", "products.json");
const imagesPath = path.join(root, "images");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this PowerShell session first.");
  process.exit(1);
}

const products = JSON.parse(await readFile(sourcePath, "utf8"));
const rows = products.map((product, index) => ({
  sourceImage: path.basename(product.image || ""),
  name: product.name,
  price: Number(product.price),
  color: product.color || "classic",
  weight: product.weight || null,
  image_url: typeof product.image === "string" && !product.image.startsWith("/manus-storage/")
    ? product.image
    : null,
  description: product.description || "Kanta snack",
  icon: product.icon || null,
  is_published: true,
  sort_order: index,
}));

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const imageFiles = (await readdir(imagesPath))
  .filter(file => /\.(jpe?g|png|webp|gif)$/i.test(file));
const imageUrls = new Map();

for (const file of imageFiles) {
  const fileBuffer = await readFile(path.join(imagesPath, file));
  const contentType = file.toLowerCase().endsWith(".png") ? "image/png"
    : file.toLowerCase().endsWith(".webp") ? "image/webp"
      : file.toLowerCase().endsWith(".gif") ? "image/gif"
        : "image/jpeg";
  const storagePath = `catalog/${file}`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, fileBuffer, { contentType, upsert: true });
  if (uploadError) {
    console.error(`Could not upload ${file}: ${uploadError.message}`);
    process.exit(1);
  }
  const { data } = supabase.storage.from("product-images").getPublicUrl(storagePath);
  imageUrls.set(file, data.publicUrl);
}

const rowsWithImages = rows.map(({ sourceImage, ...row }) => ({
  ...row,
  image_url: row.image_url || imageUrls.get(sourceImage) || null,
}));

const { data: existing, error: readError } = await supabase
  .from("snacks")
  .select("id, name, price, color, image_url");
if (readError) {
  console.error(`Could not read existing snacks: ${readError.message}`);
  process.exit(1);
}

if (!existing?.length) {
  const { error: insertError } = await supabase.from("snacks").insert(rowsWithImages);
  if (insertError) {
    console.error(`Could not import products: ${insertError.message}`);
    process.exit(1);
  }
} else {
  for (const [index, row] of rowsWithImages.entries()) {
    const match = existing[index];
    if (!match) continue;
    const { error: updateError } = await supabase
      .from("snacks")
      .update({ image_url: row.image_url })
      .eq("id", match.id);
    if (updateError) {
      console.error(`Could not update image for row ${match.id}: ${updateError.message}`);
      process.exit(1);
    }
  }
}

console.log(`Uploaded ${imageFiles.length} image assets.`);
console.log(`${existing?.length ? "Updated" : "Imported"} ${rowsWithImages.length} snack rows.`);
