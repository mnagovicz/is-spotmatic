import * as dotenv from "dotenv";
import * as path from "path";
import { S3Client } from "@aws-sdk/client-s3";
import { ApiClient } from "./api-client";
import { JobProcessor } from "./job-processor";
import { HeartbeatManager } from "./heartbeat";

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "5000");
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || "30000");
const WORK_DIR = path.resolve(process.env.WORK_DIR || "./work");
const AE_PATH = process.env.AE_PATH || "C:\\Program Files\\Adobe\\Adobe After Effects 2024\\Support Files\\afterfx.exe";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const MOCK_AE = process.env.MOCK_AE === "true";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

const S3_BUCKET = process.env.S3_BUCKET || "ae-render";

async function main() {
  console.log("=== AE Render Agent ===");
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Work dir: ${WORK_DIR}`);
  console.log(`AE path: ${AE_PATH}`);
  console.log(`Mock AE: ${MOCK_AE}`);

  if (!AGENT_API_KEY) {
    console.error("ERROR: AGENT_API_KEY is required");
    process.exit(1);
  }

  const apiClient = new ApiClient(API_BASE_URL, AGENT_API_KEY);
  const processor = new JobProcessor(apiClient, WORK_DIR, AE_PATH, s3Client, S3_BUCKET, ELEVENLABS_API_KEY, ELEVENLABS_MODEL_ID, FFMPEG_PATH, MOCK_AE);
  const heartbeat = new HeartbeatManager(apiClient, HEARTBEAT_INTERVAL_MS);

  // Start heartbeat
  heartbeat.start();

  // Main polling loop
  let isProcessing = false;

  async function poll() {
    if (isProcessing) return;

    try {
      const job = await apiClient.pollJob();

      if (job) {
        console.log(`\n[Main] Got job: ${job.id} (template: ${job.template.name})`);
        isProcessing = true;

        try {
          await processor.process(job);
        } catch (err) {
          console.error("[Main] Unhandled error in processor:", err);
        } finally {
          isProcessing = false;
        }
      }
    } catch (err) {
      console.error("[Main] Poll error:", (err as Error).message);
    }
  }

  // Start polling
  console.log("\n[Main] Starting polling loop...\n");
  setInterval(poll, POLL_INTERVAL_MS);
  poll(); // Initial poll

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Main] Shutting down...");
    heartbeat.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[Main] Shutting down...");
    heartbeat.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
