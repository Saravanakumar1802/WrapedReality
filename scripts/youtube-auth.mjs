/**
 * One-time setup: lets the build download the captions of YOUR OWN videos.
 *
 *   npm run youtube:auth
 *
 * YouTube only gives caption files to the channel owner, so this signs you in
 * with Google once (the standard "installed app" loopback flow) and saves a
 * refresh token to .env.local as YT_OAUTH_REFRESH_TOKEN. The token never leaves
 * your machine (or your GitHub secrets, if you add it there).
 *
 * Needs YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET in .env.local first
 * (a "Desktop app" OAuth client; see README → API keys).
 */
import http from "node:http";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { config as loadEnv } from "dotenv";
import { env, p } from "./util.mjs";

loadEnv({ path: p(".env.local"), override: true, quiet: true });

const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"; // required by captions.download
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

const clientId = env("YT_OAUTH_CLIENT_ID");
const clientSecret = env("YT_OAUTH_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error("Set YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET in .env.local first (README → API keys → YouTube captions).");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");
const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent", // always return a refresh token
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

/** Writes or replaces KEY=value in .env.local. */
async function saveToEnv(key, value) {
  const file = p(".env.local");
  let text = "";
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    /* new file */
  }
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
  await fs.writeFile(file, text);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") return res.writeHead(404).end();
  const done = (msg) => res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(msg);
  try {
    if (url.searchParams.get("state") !== state) throw new Error("state mismatch: start again");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") ?? "no code returned");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) throw new Error(tokens.error_description ?? tokens.error ?? "no refresh token returned");
    await saveToEnv("YT_OAUTH_REFRESH_TOKEN", tokens.refresh_token);
    done("Done. You can close this tab; the refresh token is saved in .env.local.");
    console.log("\n✓ Saved YT_OAUTH_REFRESH_TOKEN to .env.local. Run `npm run data` to fetch captions.");
  } catch (err) {
    done(`Sign-in failed: ${err.message}`);
    console.error(`\n✗ ${err.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this link, sign in with the Google account that owns the channel, and allow access:\n");
  console.log(authUrl.toString());
  console.log(`\nWaiting for Google to redirect back to ${REDIRECT} …`);
});
