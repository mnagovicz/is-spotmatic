import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface VoiceoverInput {
  filePath: string;
  startFrame: number;
}

export interface MixOptions {
  videoPath: string;
  voiceovers: VoiceoverInput[];
  backgroundAudioPath?: string;
  fps: number;
  voiceoverVolumeDb: number;
  backgroundVolumeDb: number;
  outputPath: string;
  ffmpegPath?: string;
}

export async function mixAudio(options: MixOptions): Promise<void> {
  const {
    videoPath,
    voiceovers,
    backgroundAudioPath,
    fps,
    voiceoverVolumeDb,
    backgroundVolumeDb,
    outputPath,
    ffmpegPath = "ffmpeg",
  } = options;

  const hasVoiceovers = voiceovers.length > 0;
  const hasBackground = !!backgroundAudioPath;

  // Nothing to mix — just copy the video
  if (!hasVoiceovers && !hasBackground) {
    console.log("[Mixer] No audio to mix, copying video as-is");
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", videoPath,
      "-c", "copy",
      outputPath,
    ]);
    return;
  }

  const inputs: string[] = ["-y", "-i", videoPath];
  const filterParts: string[] = [];
  const audioLabels: string[] = [];
  let inputIndex = 1;

  // Add voiceover inputs
  for (const vo of voiceovers) {
    inputs.push("-i", vo.filePath);
    const delayMs = Math.round((vo.startFrame / fps) * 1000);
    const label = `vo${inputIndex}`;
    filterParts.push(
      `[${inputIndex}]adelay=${delayMs}|${delayMs},volume=${voiceoverVolumeDb}dB[${label}]`
    );
    audioLabels.push(`[${label}]`);
    inputIndex++;
  }

  // Add background audio input
  if (hasBackground) {
    inputs.push("-i", backgroundAudioPath!);
    const label = "bg";
    filterParts.push(
      `[${inputIndex}]volume=${backgroundVolumeDb}dB[${label}]`
    );
    audioLabels.push(`[${label}]`);
    inputIndex++;
  }

  const totalAudioInputs = audioLabels.length;
  const filterComplex =
    filterParts.join(";") +
    ";" +
    audioLabels.join("") +
    `amix=inputs=${totalAudioInputs}:duration=longest:dropout_transition=0[audio]`;

  const args = [
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", "0:v",
    "-map", "[audio]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath,
  ];

  console.log(`[Mixer] Running ffmpeg with ${voiceovers.length} voiceover(s) and ${hasBackground ? "background audio" : "no background"}`);
  console.log(`[Mixer] Command: ${ffmpegPath} ${args.join(" ")}`);

  try {
    const { stderr } = await execFileAsync(ffmpegPath, args, {
      timeout: 300000, // 5 min
    });
    if (stderr) {
      console.log("[Mixer] ffmpeg stderr:", stderr.slice(-500));
    }
    console.log("[Mixer] Audio mixing complete");
  } catch (err) {
    const error = err as Error & { stderr?: string };
    throw new Error(
      `ffmpeg mixing failed: ${error.message}${error.stderr ? "\n" + error.stderr.slice(-1000) : ""}`
    );
  }
}
