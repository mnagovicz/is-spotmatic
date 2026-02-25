export interface JobData {
  id: string;
  key: string;
  value: string;
  layerName?: string;
  effectName?: string;
  effectType?: string;
}

export interface JobAsset {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  footageItemName?: string;
  folderPath?: string;
}

export interface TemplateVariable {
  id: string;
  layerName: string;
  effectName: string;
  effectType: string;
  type: string;
  label: string;
  validation?: {
    voiceId?: string;
    startFrame?: number;
    charsPerSecond?: number;
    maxDuration?: number;
    [key: string]: unknown;
  } | null;
}

export interface FootageSlot {
  id: string;
  footageItemName: string;
  folderPath: string;
}

export interface Template {
  id: string;
  name: string;
  aepFileUrl?: string;
  aepFileName?: string;
  exportCompName: string;
  controlCompName?: string;
  fps: number;
  voiceoverVolumeDb: number;
  backgroundVolumeDb: number;
  backgroundAudioUrl?: string;
  backgroundAudioName?: string;
  allowClientAudioEdit: boolean;
  variables: TemplateVariable[];
  footageSlots: FootageSlot[];
}

export interface RenderJob {
  id: string;
  templateId: string;
  status: string;
  priority: number;
  progress: number;
  voiceoverVolumeDb?: number;
  backgroundVolumeDb?: number;
  template: Template;
  jobData: JobData[];
  jobAssets: JobAsset[];
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }

    return res.json();
  }

  async pollJob(): Promise<RenderJob | null> {
    const data = await this.request("/api/agent/poll");
    return data.job || null;
  }

  async heartbeat(): Promise<void> {
    await this.request("/api/agent/heartbeat", { method: "POST" });
  }

  async updateStatus(
    jobId: string,
    status: string,
    progress?: number,
    errorMessage?: string
  ): Promise<void> {
    await this.request("/api/agent/status", {
      method: "PATCH",
      body: JSON.stringify({ jobId, status, progress, errorMessage }),
    });
  }

  async submitResult(
    jobId: string,
    outputMp4Url?: string,
    outputAepUrl?: string
  ): Promise<void> {
    await this.request("/api/agent/result", {
      method: "POST",
      body: JSON.stringify({ jobId, outputMp4Url, outputAepUrl }),
    });
  }
}
