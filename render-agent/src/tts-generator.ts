import * as fs from "fs";
import * as path from "path";

export interface TtsRequest {
  variableId: string;
  text: string;
  voiceId: string;
  startFrame: number;
}

export interface TtsResult {
  variableId: string;
  filePath: string;
  startFrame: number;
}

export async function generateTts(
  requests: TtsRequest[],
  outputDir: string,
  apiKey: string,
  modelId: string = "eleven_multilingual_v2"
): Promise<TtsResult[]> {
  fs.mkdirSync(outputDir, { recursive: true });
  const results: TtsResult[] = [];

  for (const req of requests) {
    if (!req.text.trim() || !req.voiceId) {
      console.log(`[TTS] Skipping variable ${req.variableId} (empty text or voiceId)`);
      continue;
    }

    console.log(`[TTS] Generating voiceover for variable ${req.variableId} (voice: ${req.voiceId})`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: req.text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `ElevenLabs TTS failed for ${req.variableId}: ${response.status} ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const filePath = path.join(outputDir, `vo_${req.variableId}.mp3`);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    console.log(`[TTS] Saved voiceover to ${filePath} (${arrayBuffer.byteLength} bytes)`);

    results.push({
      variableId: req.variableId,
      filePath,
      startFrame: req.startFrame,
    });
  }

  return results;
}
