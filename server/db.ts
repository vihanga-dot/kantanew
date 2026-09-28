import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { InsertSiteSettings, InsertSnack, SiteSettings, snacks, siteSettings, Snack, users, InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let seedPromise: Promise<void> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

function readSeedProducts(): Array<Record<string, unknown>> {
  const candidates = [
    path.resolve(process.cwd(), "client/public/products.json"),
    path.resolve(process.cwd(), "dist/public/products.json"),
  ];
  const seedPath = candidates.find(file => existsSync(file));
  if (!seedPath) return [];
  try {
    const parsed = JSON.parse(readFileSync(seedPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("[Catalog] Could not read seed products:", error);
    return [];
  }
}

export async function ensureCatalogSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const db = await getDb();
      if (!db) return;
      const currentSnacks = await db.select({ id: snacks.id }).from(snacks).limit(1);
      if (currentSnacks.length === 0) {
        const seedProducts = readSeedProducts();
        if (seedProducts.length > 0) {
          const rows: InsertSnack[] = seedProducts.map((product, index) => ({
            name: String(product.name ?? "Unnamed snack"),
            price: Number(product.price ?? 0),
            color: String(product.color ?? "classic"),
            weight: product.weight ? String(product.weight) : null,
            imageUrl: product.image ? String(product.image) : null,
            description: String(product.description ?? "A familiar Kanta favourite."),
            icon: product.icon ? String(product.icon) : null,
            isPublished: true,
            sortOrder: index,
          }));
          await db.insert(snacks).values(rows);
        }
      }

      const settings = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
      if (settings.length === 0) {
        await db.insert(siteSettings).values({
          announcement: "Made in Sri Lanka · Shared everywhere",
          heroTitle: "A little joy, packed fresh.",
          heroSubtitle: "Familiar flavours and satisfying crunch for tea breaks, school bags, and every in-between moment.",
          aboutTitle: "Good ingredients. Good company.",
          aboutBody: "We make snacks with care in Sri Lanka, bringing quality and warmth to the everyday.",
        });
      }
    })().catch(error => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function listPublicSnacks(): Promise<Snack[]> {
  await ensureCatalogSeeded();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(snacks).where(eq(snacks.isPublished, true)).orderBy(asc(snacks.sortOrder), asc(snacks.id));
}

export async function listAllSnacks(): Promise<Snack[]> {
  await ensureCatalogSeeded();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(snacks).orderBy(asc(snacks.sortOrder), asc(snacks.id));
}

export async function createSnack(input: InsertSnack) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(snacks).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(snacks).where(eq(snacks.id, id)).limit(1);
  return created[0];
}

export async function updateSnack(id: number, input: Partial<InsertSnack>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(snacks).set(input).where(eq(snacks.id, id));
  const updated = await db.select().from(snacks).where(eq(snacks.id, id)).limit(1);
  return updated[0];
}

export async function deleteSnack(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(snacks).where(eq(snacks.id, id));
  return { success: true } as const;
}

export async function getSiteSettings(): Promise<SiteSettings | undefined> {
  await ensureCatalogSeeded();
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(siteSettings).limit(1);
  return result[0];
}

export async function updateSiteSettings(input: Partial<InsertSiteSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = await db.select().from(siteSettings).limit(1);
  if (current[0]) {
    await db.update(siteSettings).set(input).where(eq(siteSettings.id, current[0].id));
  } else {
    await db.insert(siteSettings).values({
      announcement: input.announcement ?? "Made in Sri Lanka · Shared everywhere",
      heroTitle: input.heroTitle ?? "A little joy, packed fresh.",
      heroSubtitle: input.heroSubtitle ?? "Familiar flavours and satisfying crunch for tea breaks, school bags, and every in-between moment.",
      aboutTitle: input.aboutTitle ?? "Good ingredients. Good company.",
      aboutBody: input.aboutBody ?? "We make snacks with care in Sri Lanka, bringing quality and warmth to the everyday.",
    });
  }
  return getSiteSettings();
}
