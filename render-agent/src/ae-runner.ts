import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface AeRunnerOptions {
  aePath: string;
  jsxFilePath: string;
  outputMp4Path: string;
  ffmpegPath?: string;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}

function findOutputVideo(outputDir: string, excludeFile: string): string | null {
  const videoExtensions = [".mxf", ".avi", ".mov", ".mp4", ".mkv", ".wmv"];
  if (!fs.existsSync(outputDir)) return null;
  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    if (filePath === excludeFile) continue;
    const ext = path.extname(file).toLowerCase();
    if (videoExtensions.includes(ext)) {
      const stat = fs.statSync(filePath);
      if (stat.size > 10000) {
        console.log(`[AE Runner] Found output video: ${filePath} (${Math.round(stat.size/1024)}KB)`);
        return filePath;
      }
    }
  }
  return null;
}

function convertToMp4(
  inputPath: string,
  outputMp4Path: string,
  ffmpegPath: string,
  resolve: () => void,
  reject: (err: Error) => void
): void {
  const ext = path.extname(inputPath).toUpperCase();
  console.log(`[AE Runner] Converting ${ext} → MP4: ${path.basename(inputPath)}`);
  try {
    execSync(
      `"${ffmpegPath}" -y -i "${inputPath}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${outputMp4Path}"`,
      { stdio: "pipe" }
    );
    console.log(`[AE Runner] Conversion complete: ${outputMp4Path}`);
    try { fs.unlinkSync(inputPath); } catch {}
    resolve();
  } catch (err) {
    reject(new Error(`ffmpeg conversion failed: ${(err as Error).message}`));
  }
}

export function runAfterEffects(options: AeRunnerOptions): Promise<void> {
  const {
    aePath,
    jsxFilePath,
    outputMp4Path,
    ffmpegPath = "ffmpeg",
    timeoutMs = 600000,
    onProgress,
  } = options;

  const outputDir = path.dirname(outputMp4Path);

  return new Promise((resolve, reject) => {
    console.log(`[AE Runner] Starting After Effects: ${aePath}`);
    console.log(`[AE Runner] JSX Script: ${jsxFilePath}`);

    const args = ["-r", jsxFilePath];
    const isAeRender = aePath.toLowerCase().includes("aerender");
    if (isAeRender) { args.length = 0; args.push("-s", jsxFilePath); }

    const proc = spawn(aePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    proc.stdout.on("data", (data) => {
      console.log(`[AE stdout] ${data.toString().trim()}`);
    });
    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      console.error(`[AE stderr] ${text.trim()}`);
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`After Effects timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`After Effects exited with code ${code}. stderr: ${stderr}`));
        return;
      }

      // Log available templates if debug file exists
      const templatesFile = path.join(outputDir, "ae_templates.txt");
      if (fs.existsSync(templatesFile)) {
        const templates = fs.readFileSync(templatesFile, "utf-8").trim();
        console.log(`[AE Runner] Available AE templates:\n${templates}`);
        try { fs.unlinkSync(templatesFile); } catch {}
      }

      // Check render_status.txt
      const statusFilePath = path.join(outputDir, "render_status.txt");
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, "utf-8").trim();
        const statusLines = statusContent.split("\n");
        if (statusLines[0].trim() === "FAILED") {
          reject(new Error(statusLines.slice(1).join("\n") || "Unknown render error"));
          return;
        }
        console.log("[AE Runner] render_status.txt: SUCCESS");
      }

      // If MP4 already exists
      if (fs.existsSync(outputMp4Path)) { resolve(); return; }

      // Find any video file
      const found = findOutputVideo(outputDir, outputMp4Path);
      if (found) { convertToMp4(found, outputMp4Path, ffmpegPath, resolve, reject); return; }

      // Log output dir contents
      try {
        const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
        console.log(`[AE Runner] Output dir contents: ${files.join(", ") || "(empty)"}`);
      } catch {}

      // Wait 3s and retry
      setTimeout(() => {
        if (fs.existsSync(outputMp4Path)) { resolve(); return; }
        const found2 = findOutputVideo(outputDir, outputMp4Path);
        if (found2) {
          convertToMp4(found2, outputMp4Path, ffmpegPath, resolve, reject);
        } else {
          reject(new Error(`Output file not found: ${outputMp4Path}`));
        }
      }, 3000);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start After Effects: ${err.message}`));
    });

    if (onProgress) {
      let p = 10;
      const iv = setInterval(() => { if (p < 90) onProgress(p += 5); }, 10000);
      proc.on("close", () => clearInterval(iv));
    }
  });
}
