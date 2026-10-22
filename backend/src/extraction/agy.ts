import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "brochure.schema.json");
export const DEFAULT_MODEL = "gemini-3.8-flash-medium";

export interface AgyResult {
  output: unknown;
  tokens: number;
  seconds: number;
}

/**
 * Run `agy -p` in a throwaway cwd. If pdfBytes is given it is copied there as brochure.pdf
 * (for scanned PDFs the model reads it itself).
 */
async function runAgyOnce(
  prompt: string,
  opts: { model?: string; timeoutSec?: number; pdfBytes?: Buffer; agyBin?: string } = {},
): Promise<AgyResult> {
  const { model = DEFAULT_MODEL, timeoutSec = 420, pdfBytes, agyBin = process.env.AGY_BIN || "agy" } = opts;
  const dir = mkdtempSync(join(tmpdir(), "chessatlas-agy-"));
  try {
    if (pdfBytes) writeFileSync(join(dir, "brochure.pdf"), pdfBytes);
    copyFileSync(SCHEMA_PATH, join(dir, "schema.json"));
    const args = ["-p", prompt, "--model", model, "--json-schema", join(dir, "schema.json"), "--output-format", "json", "--mode", "plan", "--print-timeout", `${timeoutSec}s`];
    const started = Date.now();
    const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const p = spawn(agyBin, args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      const kill = setTimeout(() => p.kill("SIGKILL"), (timeoutSec + 30) * 1000);
      p.on("error", (e) => {
        clearTimeout(kill);
        reject(new Error(`cannot run agy: ${e.message}`));
      });
      p.on("close", (c) => {
        clearTimeout(kill);
        resolve({ stdout: out, stderr: err, code: c });
      });
    });
    const seconds = (Date.now() - started) / 1000;
    let parsed: any;
    try {
      parsed = JSON.parse(stdout.slice(stdout.indexOf("{")));
    } catch {
      throw new Error(`agy produced no JSON (exit ${code}): ${(stderr || stdout).slice(0, 300)}`);
    }
    if (parsed.status !== "SUCCESS") throw new Error(`agy status ${parsed.status}: ${String(parsed.error ?? parsed.response ?? "").slice(0, 300)}`);
    let output = parsed.structured_output;
    if (output == null && typeof parsed.response === "string") {
      try {
        output = JSON.parse(parsed.response);
      } catch {}
    }
    if (output == null) throw new Error(`agy returned no structured_output (response: ${String(parsed.response ?? "").slice(0, 150)})`);
    return { output, tokens: parsed.usage?.total_tokens ?? 0, seconds };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const TRANSIENT = /stream was interrupted|timed? ?out|unavailable|overloaded|rate|429|503|internal|no JSON|no structured_output/i;

/** runAgyOnce with one retry for transient CLI/backend errors. */
export async function runAgy(...a: Parameters<typeof runAgyOnce>): Promise<AgyResult> {
  try {
    return await runAgyOnce(...a);
  } catch (e) {
    if (!TRANSIENT.test((e as Error).message)) throw e;
    await new Promise((r) => setTimeout(r, 5000));
    return runAgyOnce(...a);
  }
}
