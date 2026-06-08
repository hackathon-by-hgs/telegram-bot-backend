import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

/** A JSON Schema object (subset) describing the expected model output. */
export type JsonSchema = Record<string, unknown>;

/**
 * Thin wrapper around the Google Gen AI SDK (@google/genai).
 *
 * - `smart`  → richer reasoning (recommendations).
 * - `fast`   → cheap, high-volume classification (per-airdrop scam scoring).
 *
 * Resilient by design (mirrors CryptoService): returns null on any failure so
 * callers degrade gracefully instead of throwing.
 */
@Injectable()
export class GeminiService {
  private readonly log = new Logger(GeminiService.name);
  private readonly client?: GoogleGenAI;
  private readonly smartModel: string;
  private readonly fastModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    // Degrade gracefully when unconfigured — the rest of the app still boots.
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : undefined;
    this.smartModel = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash';
    this.fastModel =
      this.config.get<string>('GEMINI_MODEL_FAST') ?? 'gemini-3.1-flash-lite';
  }

  get enabled(): boolean {
    return !!this.client;
  }

  /**
   * Generate a JSON object validated against `schema`. Returns null on any
   * failure (missing key, network error, unparseable output).
   */
  async generateJson<T>(
    prompt: string,
    schema: JsonSchema,
    opts: { system?: string; tier?: 'smart' | 'fast' } = {},
  ): Promise<T | null> {
    if (!this.client) {
      this.log.warn('Gemini disabled (no GEMINI_API_KEY)');
      return null;
    }
    const model = opts.tier === 'fast' ? this.fastModel : this.smartModel;
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      });
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as T;
    } catch (err) {
      this.log.warn(`gemini ${model} call failed: ${(err as Error).message}`);
      return null;
    }
  }
}
