/**
 * Console 3D models: download → optimise → install.
 *
 *   npm run models                      download every enabled model from Sketchfab
 *                                       (needs SKETCHFAB_TOKEN in .env.local)
 *   npm run models -- PS5=C:\path\file  use a file you downloaded yourself
 *                                       (.glb, .gltf, or the .zip Sketchfab gives you)
 *   npm run models -- --remove PS5      go back to the code-built console
 *
 * Output:
 *   public/models/<key>.glb             Meshopt-compressed geometry, WebP textures
 *   src/data/generated/models.json      what the site loads + the credit line for each model
 *
 * Models without a file fall back to the code-built consoles, so the site always works.
 */
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import sharp from "sharp";
import { unzipSync } from "fflate";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, getBounds, join, meshopt, prune, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { MODELS, TEXTURE_MAX, TRIANGLE_BUDGET } from "./models.config.mjs";
import { exists, log, p, readJson, writeJson } from "./util.mjs";

dotenv.config({ path: p(".env.local"), quiet: true });

const API = "https://api.sketchfab.com/v3/models";
const MANIFEST = p("src/data/generated/models.json");
const OUT_DIR = p("public/models");
const CACHE = p("cache/models/consoles");
const LICENSES = {
  by: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  cc0: { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  // Sketchfab's own licence: use in a project is fine, reselling or redistributing the file on its own is not
  "free-st": { name: "Sketchfab Free Standard", url: "https://sketchfab.com/licenses" },
  st: { name: "Sketchfab Standard", url: "https://sketchfab.com/licenses" },
};

async function fetchOk(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.split("?")[0]}`);
  return res;
}

/** Title, author and licence from Sketchfab's public API (no login needed). */
async function fetchCredit(uid) {
  const m = await (await fetchOk(`${API}/${uid}`)).json();
  const license = LICENSES[m.license?.slug];
  if (!license) {
    throw new Error(
      `"${m.name}" is licensed "${m.license?.label ?? "unknown"}", which this site can't use. Pick a CC BY, CC0 or Sketchfab Standard model.`,
    );
  }
  return {
    title: m.name,
    author: m.user.displayName,
    authorUrl: m.user.profileUrl,
    sourceUrl: m.viewerUrl,
    license: license.name,
    licenseUrl: license.url,
  };
}

/** Downloads the model archive from Sketchfab; returns the path of a .glb or .gltf on disk. */
async function download(key, uid, token) {
  const info = await (await fetchOk(`${API}/${uid}/download`, { headers: { Authorization: `Token ${token}` } })).json();
  const dir = path.join(CACHE, key);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  if (info.glb?.url) {
    const file = path.join(dir, "source.glb");
    await fs.writeFile(file, Buffer.from(await (await fetchOk(info.glb.url)).arrayBuffer()));
    return file;
  }
  if (!info.gltf?.url) throw new Error("Sketchfab returned no glTF download for this model.");
  const zip = Buffer.from(await (await fetchOk(info.gltf.url)).arrayBuffer());
  return unzip(zip, dir);
}

/** Unpacks a Sketchfab .zip and returns the .gltf/.glb inside it. */
async function unzip(buffer, dir) {
  const files = unzipSync(new Uint8Array(buffer));
  let entry = null;
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("/")) continue;
    const target = path.join(dir, name);
    if (!target.startsWith(dir)) continue; // never write outside the cache folder
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    if (/\.(gltf|glb)$/i.test(name) && (!entry || name.length < entry.length)) entry = name;
  }
  if (!entry) throw new Error("No .gltf or .glb file inside the archive.");
  return path.join(dir, entry);
}

async function resolveLocal(key, file) {
  const abs = path.resolve(file);
  if (!(await exists(abs))) throw new Error(`File not found: ${abs}`);
  if (/\.zip$/i.test(abs)) {
    const dir = path.join(CACHE, key);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    return unzip(await fs.readFile(abs), dir);
  }
  if (!/\.(gltf|glb)$/i.test(abs)) throw new Error(`Unsupported file type: ${abs} (use .glb, .gltf or .zip)`);
  return abs;
}

const countTriangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, prim) => n + (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3, 0);

/** Shrinks a model for the web without changing how it looks at showcase size. */
async function optimise(io, source, target) {
  const doc = await io.read(source);
  const before = countTriangles(doc);
  const steps = [dedup(), prune(), resample(), weld()];
  if (before > TRIANGLE_BUDGET) {
    steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGLE_BUDGET / before, error: 0.0008 }));
  }
  steps.push(
    flatten(), // bake node transforms so meshes can be merged…
    join(), // …then merge everything that shares a material: far fewer draw calls
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [TEXTURE_MAX, TEXTURE_MAX], quality: 84 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await doc.transform(...steps);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await io.write(target, doc);
  return {
    triangles: Math.round(countTriangles(doc)),
    trianglesBefore: Math.round(before),
    drawCalls: doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives()).length,
    textures: doc.getRoot().listTextures().length,
    bounds: { min: min.map(round), max: max.map(round) },
    bytes: (await fs.stat(target)).size,
  };
}

const round = (v) => Math.round(v * 1e4) / 1e4;
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

async function main() {
  const args = process.argv.slice(2);
  const manifest = await readJson(MANIFEST, {});

  if (args[0] === "--remove") {
    for (const key of args.slice(1)) {
      delete manifest[key];
      await fs.rm(path.join(OUT_DIR, `${key.toLowerCase()}.glb`), { force: true });
      log.ok(`${key}: removed, the code-built console is back`);
    }
    return writeJson(MANIFEST, manifest);
  }

  const local = Object.fromEntries(
    args.filter((a) => a.includes("=")).map((a) => [a.slice(0, a.indexOf("=")).toUpperCase(), a.slice(a.indexOf("=") + 1)]),
  );
  const keys = Object.keys(local).length ? Object.keys(local) : Object.keys(MODELS).filter((k) => MODELS[k].enabled);
  const token = process.env.SKETCHFAB_TOKEN?.trim();
  if (!Object.keys(local).length && !token) {
    log.warn("No SKETCHFAB_TOKEN in .env.local.");
    log.info("1. Sign in at sketchfab.com (free) and open https://sketchfab.com/settings/password");
    log.info("2. Copy the API token and add this line to .env.local:  SKETCHFAB_TOKEN=your-token");
    log.info("3. Run `npm run models` again.");
    log.info("Or download a model yourself and run:  npm run models -- PS5=path/to/file.zip");
    process.exitCode = 1;
    return;
  }

  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

  let failed = 0;
  for (const key of keys) {
    const cfg = MODELS[key];
    if (!cfg) {
      log.warn(`${key}: not in scripts/models.config.mjs (known: ${Object.keys(MODELS).join(", ")})`);
      failed++;
      continue;
    }
    log.step(`${key}`);
    try {
      const credit = await fetchCredit(cfg.uid);
      log.info(`"${credit.title}" by ${credit.author} (${credit.license})`);
      const source = local[key] ? await resolveLocal(key, local[key]) : await download(key, cfg.uid, token);
      const file = `${key.toLowerCase()}.glb`;
      const stats = await optimise(io, source, path.join(OUT_DIR, file));
      manifest[key] = { url: `/models/${file}`, ...stats, view: cfg.view, credit };
      log.ok(
        `${mb(stats.bytes)}, ${stats.triangles.toLocaleString()} triangles` +
          (stats.trianglesBefore > stats.triangles ? ` (from ${stats.trianglesBefore.toLocaleString()})` : "") +
          `, ${stats.drawCalls} draw calls, ${stats.textures} textures`,
      );
    } catch (err) {
      failed++;
      log.warn(`${key}: ${err.message}`);
      if (/^401|^403/.test(err.message)) log.info("The token was rejected. Check SKETCHFAB_TOKEN in .env.local.");
    }
  }
  await writeJson(MANIFEST, manifest);
  if (failed) process.exitCode = 1;
  else log.ok("Done. Restart `npm run dev` (or rebuild) to see the models.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
