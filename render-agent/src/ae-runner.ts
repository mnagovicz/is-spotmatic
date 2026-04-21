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

// Find any video file created in the output directory (AE may name it differently)
function findOutputVideo(outputDir: string, excludeFile: string): string | null {
  const videoExtensions = [".mxf", ".avi", ".mov", ".mp4", ".mkv"];
  if (!fs.existsSync(outputDir)) return null;

  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    if (filePath === excludeFile) continue;
    const ext = path.extname(file).toLowerCase();
    if (videoExtensions.includes(ext)) {
      const stat = fs.statSync(filePath);
      if (stat.size > 1000) { // must be at least 1KB
        console.log(`[AE Runner] Found output video: ${filePath} (${stat.size} bytes)`);
        return filePath;
      }
    }
  }
  return null;
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
    if (isAeRender) {
      args.length = 0;
      args.push("-s", jsxFilePath);
    }

    const proc = spawn(aePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`[AE stdout] ${text.trim()}`);
      const progressMatch = text.match(/PROGRESS:\s*(\d+)/);
      if (progressMatch && onProgress) {
        onProgress(parseInt(progressMatch[1]));
      }
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

      // Check render_status.txt
      const statusFilePath = path.join(outputDir, "render_status.txt");
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, "utf-8").trim();
        const statusLines = statusContent.split("\n");
        if (statusLines[0].trim() === "FAILED") {
          const errorMsg = statusLines.slice(1).join("\n") || "Unknown render error";
          reject(new Error(errorMsg));
          return;
        }
        console.log("[AE Runner] render_status.txt: SUCCESS");
      }

      // If MP4 already exists (older AE), done
      if (fs.existsSync(outputMp4Path)) {
        resolve();
        return;
      }

      // Find any video file AE created in output dir
      const foundVideo = findOutputVideo(outputDir, outputMp4Path);

      if (foundVideo) {
        convertToMp4(foundVideo, outputMp4Path, ffmpegPath, resolve, reject);
        return;
      }

      // Wait 3s and try again (AE might still be flushing)
      setTimeout(() => {
        if (fs.existsSync(outputMp4Path)) {
          resolve();
          return;
        }
        const foundVideo2 = findOutputVideo(outputDir, outputMp4Path);
        if (foundVideo2) {
          convertToMp4(foundVideo2, outputMp4Path, ffmpegPath, resolve, reject);
        } else {
          // List what IS in the output dir for debugging
          try {
            const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
            console.log(`[AE Runner] Output dir contents: ${files.join(", ") || "(empty)"}`);
          } catch {}
          reject(new Error(`Output file not found: ${outputMp4Path}`));
        }
      }, 3000);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start After Effects: ${err.message}`));
    });

    if (onProgress) {
      let simulatedProgress = 10;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 5;
          onProgress(simulatedProgress);
        }
      }, 10000);
      proc.on("close", () => clearInterval(progressInterval));
    }
  });
}

function convertToMp4(
  inputPath: string,
  outputMp4Path: string,
  ffmpegPath: string,
  resolve: () => void,
  reject: (err: Error) => void
): void {
  console.log(`[AE Runner] Converting ${path.extname(inputPath).toUpperCase()} → MP4: ${inputPath}`);
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
