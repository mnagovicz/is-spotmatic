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

  // Determine if using aerender.exe (headless) or afterfx.exe (GUI)
  const isAeRender = aePath.toLowerCase().includes("aerender");

  return new Promise((resolve, reject) => {
    console.log(`[AE Runner] Mode: ${isAeRender ? "aerender (headless)" : "afterfx (GUI)"}`);
    console.log(`[AE Runner] Executable: ${aePath}`);
    console.log(`[AE Runner] JSX Script: ${jsxFilePath}`);
    console.log(`[AE Runner] Output: ${outputMp4Path}`);

    let args: string[];

    if (isAeRender) {
      // aerender.exe: headless render with script for pre-processing
      // -project: open this AEP (will be set in JSX, but aerender needs a project)
      // -r: run this script AFTER opening project (modifies layers, sets text etc.)
      // -comp: composition to render
      // -output: output file path
      // -OMtemplate: output module template
      // Note: we use JSX to modify the project, aerender handles the render
      args = [
        "-r", jsxFilePath,
        "-v", "ERRORS_AND_PROGRESS",
      ];
    } else {
      // afterfx.exe: run JSX script (script handles everything incl. render queue)
      args = ["-r", jsxFilePath];
    }

    const proc = spawn(aePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false, // allow window for afterfx
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      console.log(`[AE stdout] ${text.trim()}`);

      const progressMatch = text.match(/PROGRESS:\s*(\d+)/);
      if (progressMatch && onProgress) {
        onProgress(parseInt(progressMatch[1]));
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      // Filter known benign warnings
      const trimmed = text.trim();
      if (trimmed && !trimmed.includes("CRPreferences") && !trimmed.includes("asio async_connect")) {
        console.error(`[AE stderr] ${trimmed}`);
      }
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`After Effects timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      console.log(`[AE Runner] Process exited with code: ${code}`);

      if (code !== 0 && code !== null) {
        reject(new Error(`After Effects exited with code ${code}.\nstdout: ${stdout}\nstderr: ${stderr}`));
        return;
      }

      // Check render_status.txt (written by JSX)
      const statusFilePath = path.join(outputDir, "render_status.txt");
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, "utf-8").trim();
        const statusLines = statusContent.split(/\r?\n/);
        const status = statusLines[0].trim();

        if (status === "FAILED") {
          reject(new Error(statusLines.slice(1).join("\n") || "Unknown render error"));
          return;
        }

        if (status === "SUCCESS") {
          const reportedPath = statusLines[1]?.trim();
          if (reportedPath) {
            console.log(`[AE Runner] JSX reported output: ${reportedPath}`);
          }
        }
      }

      // Log output dir
      try {
        const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
        console.log(`[AE Runner] Output dir: ${files.map(f => {
          const fp = path.join(outputDir, f);
          const size = fs.existsSync(fp) && fs.statSync(fp).isFile() 
            ? `(${Math.round(fs.statSync(fp).size/1024)}KB)` : "(dir)";
          return `${f}${size}`;
        }).join(", ")}`);
      } catch {}

      // Check if MP4 exists
      if (fs.existsSync(outputMp4Path)) {
        const size = fs.statSync(outputMp4Path).size;
        console.log(`[AE Runner] ✅ MP4 found: ${outputMp4Path} (${Math.round(size/1024)}KB)`);
        resolve();
        return;
      }

      // Look for any video file
      const videoExtensions = [".mxf", ".avi", ".mov", ".mkv", ".wmv", ".mp4"];
      let foundVideo: string | null = null;
      if (fs.existsSync(outputDir)) {
        for (const file of fs.readdirSync(outputDir)) {
          const fp = path.join(outputDir, file);
          const ext = path.extname(file).toLowerCase();
          if (videoExtensions.includes(ext) && fp !== outputMp4Path) {
            const stat = fs.statSync(fp);
            if (stat.size > 10000) {
              foundVideo = fp;
              break;
            }
          }
        }
      }

      if (foundVideo) {
        const ext = path.extname(foundVideo).toLowerCase();
        if (ext === ".mp4") {
          console.log(`[AE Runner] Copying MP4 to expected path`);
          fs.copyFileSync(foundVideo, outputMp4Path);
          resolve();
        } else {
          console.log(`[AE Runner] Converting ${ext.toUpperCase()} → MP4`);
          try {
            execSync(
              `"${ffmpegPath}" -y -i "${foundVideo}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${outputMp4Path}"`,
              { stdio: "pipe" }
            );
            try { fs.unlinkSync(foundVideo); } catch {}
            resolve();
          } catch (err) {
            reject(new Error(`ffmpeg failed: ${(err as Error).message}`));
          }
        }
        return;
      }

      // Final wait and retry
      setTimeout(() => {
        if (fs.existsSync(outputMp4Path)) { resolve(); return; }
        reject(new Error(`Output file not found after render: ${outputMp4Path}`));
      }, 3000);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start After Effects: ${err.message}`));
    });

    if (onProgress) {
      let p = 10;
      const iv = setInterval(() => { if (p < 90) onProgress(p += 3); }, 15000);
      proc.on("close", () => clearInterval(iv));
    }
  });
}
