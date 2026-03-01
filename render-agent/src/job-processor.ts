import * as fs from "fs";
import * as path from "path";
import { ApiClient, RenderJob } from "./api-client";
import { buildJsx } from "./jsx-builder";
import { runAfterEffects } from "./ae-runner";
import { generateTts, TtsRequest } from "./tts-generator";
import { mixAudio } from "./audio-mixer";
import { execSync } from "child_process";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export class JobProcessor {
  private client: ApiClient;
  private workDir: string;
  private aePath: string;
  private s3: S3Client;
  private s3Bucket: string;
  private elevenLabsApiKey: string;
  private elevenLabsModelId: string;
  private ffmpegPath: string;
  private mockAe: boolean;

  constructor(
    client: ApiClient,
    workDir: string,
    aePath: string,
    s3: S3Client,
    s3Bucket: string,
    elevenLabsApiKey: string = "",
    elevenLabsModelId: string = "eleven_multilingual_v2",
    ffmpegPath: string = "ffmpeg",
    mockAe: boolean = false
  ) {
    this.client = client;
    this.workDir = workDir;
    this.aePath = aePath;
    this.s3 = s3;
    this.s3Bucket = s3Bucket;
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.elevenLabsModelId = elevenLabsModelId;
    this.ffmpegPath = ffmpegPath;
    this.mockAe = mockAe;
  }

  async process(job: RenderJob): Promise<void> {
    const jobDir = path.join(this.workDir, `job_${job.id}`);
    const footageDir = path.join(jobDir, "footage");
    const outputDir = path.join(jobDir, "output");
    const voiceoverDir = path.join(jobDir, "voiceovers");

    try {
      // Create work directories
      fs.mkdirSync(jobDir, { recursive: true });
      fs.mkdirSync(footageDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });

      console.log(`[Processor] Processing job ${job.id}`);

      // ── Step 1: Download AEP, assets, and background audio (5-20%) ──
      await this.client.updateStatus(job.id, "DOWNLOADING", 5);

      const aepLocalPath = path.join(jobDir, job.template.aepFileName || "template.aep");

      if (job.template.aepFileUrl) {
        await this.downloadFromS3(job.template.aepFileUrl, aepLocalPath);
      }

      // Download job assets (uploaded images)
      for (const asset of job.jobAssets) {
        if (asset.folderPath && asset.footageItemName) {
          const assetDir = path.join(footageDir, asset.folderPath);
          fs.mkdirSync(assetDir, { recursive: true });
          const assetPath = path.join(assetDir, asset.footageItemName);
          await this.downloadFromS3(asset.fileUrl, assetPath);
        } else {
          const assetPath = path.join(footageDir, asset.originalName);
          await this.downloadFromS3(asset.fileUrl, assetPath);
        }
      }

      // Download background audio if configured
      let backgroundAudioPath: string | undefined;
      if (job.template.backgroundAudioUrl) {
        backgroundAudioPath = path.join(jobDir, job.template.backgroundAudioName || "background.wav");
        await this.downloadFromS3(job.template.backgroundAudioUrl, backgroundAudioPath);
        console.log(`[Processor] Downloaded background audio: ${backgroundAudioPath}`);
      }

      await this.client.updateStatus(job.id, "DOWNLOADING", 20);

      // ── Step 2: Generate TTS voiceovers (20-30%) ──
      const voiceoverVariables = job.template.variables.filter(
        (v) => v.type === "VOICEOVER" && v.validation?.voiceId
      );

      const ttsRequests: TtsRequest[] = [];
      for (const v of voiceoverVariables) {
        const jobDataEntry = job.jobData.find((d) => d.key === v.id);
        const text = jobDataEntry?.value;
        if (text && v.validation?.voiceId) {
          ttsRequests.push({
            variableId: v.id,
            text,
            voiceId: v.validation.voiceId,
            startFrame: v.validation.startFrame ?? 0,
          });
        }
      }

      let ttsResults: { variableId: string; filePath: string; startFrame: number }[] = [];

      if (ttsRequests.length > 0 && this.elevenLabsApiKey) {
        await this.client.updateStatus(job.id, "GENERATING_TTS", 22);
        ttsResults = await generateTts(
          ttsRequests,
          voiceoverDir,
          this.elevenLabsApiKey,
          this.elevenLabsModelId
        );
        console.log(`[Processor] Generated ${ttsResults.length} voiceover(s)`);
        await this.client.updateStatus(job.id, "GENERATING_TTS", 30);
      } else if (ttsRequests.length > 0 && !this.elevenLabsApiKey) {
        console.warn("[Processor] VOICEOVER variables found but ELEVENLABS_API_KEY not set, skipping TTS");
      }

      // ── Step 3: Build footage replacements ──
      const footageReplacements: { originalName: string; newFilePath: string }[] = [];

      for (const asset of job.jobAssets) {
        if (asset.footageItemName) {
          const replacementPath = asset.folderPath
            ? path.join(footageDir, asset.folderPath, asset.footageItemName)
            : path.join(footageDir, asset.originalName);
          footageReplacements.push({
            originalName: asset.footageItemName,
            newFilePath: replacementPath,
          });
        }
      }

      // ── Step 4: Generate JSX and render in AE (30-80%) ──
      await this.client.updateStatus(job.id, "RENDERING", 32);

      const outputAepPath = path.join(outputDir, "output.aep");
      const outputMp4Path = path.join(outputDir, "output.mp4");

      const jsxCode = buildJsx(
        job,
        aepLocalPath,
        outputAepPath,
        outputMp4Path,
        footageReplacements
      );

      const jsxPath = path.join(jobDir, `job_${job.id}.jsx`);
      fs.writeFileSync(jsxPath, jsxCode, "utf-8");
      console.log(`[Processor] JSX written to ${jsxPath}`);

      await this.client.updateStatus(job.id, "RENDERING", 35);

      if (this.mockAe) {
        // Mock AE: generate a 5s test video with ffmpeg (no drawtext - may not be available)
        console.log(`[Processor] MOCK_AE: generating test video with ffmpeg`);
        execSync(
          `${this.ffmpegPath} -y -f lavfi -i color=c=0x222222:s=1920x1080:d=5:r=25 -c:v libx264 -pix_fmt yuv420p "${outputMp4Path}"`,
          { stdio: "pipe" }
        );
        console.log(`[Processor] MOCK_AE: test video created`);
      } else {
        await runAfterEffects({
          aePath: this.aePath,
          jsxFilePath: jsxPath,
          outputMp4Path,
          timeoutMs: 600000, // 10 min
          onProgress: async (progress) => {
            const mapped = 35 + Math.floor(progress * 0.45); // Map 0-100 to 35-80
            try {
              await this.client.updateStatus(job.id, "RENDERING", mapped);
            } catch {
              // Ignore progress update errors
            }
          },
        });
      }

      console.log(`[Processor] Render complete for job ${job.id}`);

      // ── Step 5: Mix audio with ffmpeg (80-90%) ──
      const needsMixing = ttsResults.length > 0 || backgroundAudioPath;
      let finalMp4Path = outputMp4Path;

      if (needsMixing && fs.existsSync(outputMp4Path)) {
        await this.client.updateStatus(job.id, "MIXING", 82);

        const fps = job.template.fps || 25;
        const voiceoverVolumeDb = job.voiceoverVolumeDb ?? job.template.voiceoverVolumeDb ?? 0;
        const backgroundVolumeDb = job.backgroundVolumeDb ?? job.template.backgroundVolumeDb ?? -10;

        finalMp4Path = path.join(outputDir, "output_final.mp4");

        await mixAudio({
          videoPath: outputMp4Path,
          voiceovers: ttsResults.map((r) => ({
            filePath: r.filePath,
            startFrame: r.startFrame,
          })),
          backgroundAudioPath,
          fps,
          voiceoverVolumeDb,
          backgroundVolumeDb,
          outputPath: finalMp4Path,
          ffmpegPath: this.ffmpegPath,
        });

        console.log(`[Processor] Audio mixing complete for job ${job.id}`);
        await this.client.updateStatus(job.id, "MIXING", 90);
      }

      // ── Step 6: Upload results (90-100%) ──
      await this.client.updateStatus(job.id, "UPLOADING", 91);

      let mp4Key: string | undefined;
      let aepKey: string | undefined;

      if (fs.existsSync(finalMp4Path)) {
        mp4Key = `outputs/${job.id}/output.mp4`;
        await this.uploadToS3(finalMp4Path, mp4Key, "video/mp4");
        await this.client.updateStatus(job.id, "UPLOADING", 95);
      }

      if (fs.existsSync(outputAepPath)) {
        aepKey = `outputs/${job.id}/output.aep`;
        await this.uploadToS3(outputAepPath, aepKey, "application/octet-stream");
        await this.client.updateStatus(job.id, "UPLOADING", 98);
      }

      // ── Step 7: Submit result ──
      await this.client.submitResult(job.id, mp4Key, aepKey);
      await this.client.updateStatus(job.id, "REVIEW", 100);

      console.log(`[Processor] Job ${job.id} completed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Processor] Job ${job.id} failed:`, errorMessage);

      try {
        await this.client.updateStatus(
          job.id,
          "FAILED",
          undefined,
          errorMessage
        );
      } catch {
        console.error("[Processor] Failed to report error to API");
      }
    } finally {
      // Cleanup work directory
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
        console.log(`[Processor] Cleaned up ${jobDir}`);
      } catch {
        console.warn(`[Processor] Failed to cleanup ${jobDir}`);
      }
    }
  }

  private async downloadFromS3(key: string, localPath: string): Promise<void> {
    console.log(`[S3] Downloading ${key} -> ${localPath}`);

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      })
    );

    const stream = response.Body;
    if (!stream) throw new Error(`Empty response for key ${key}`);

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const dir = path.dirname(localPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, Buffer.concat(chunks));
  }

  private async uploadToS3(
    localPath: string,
    key: string,
    contentType: string
  ): Promise<void> {
    console.log(`[S3] Uploading ${localPath} -> ${key}`);

    const body = fs.readFileSync(localPath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}
