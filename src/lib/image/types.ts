export type ImageGenerationRequest = { prompt: string; width?: number; height?: number; steps?: number };
export type ImageGenerationResult = { provider: string; model: string; mimeType: string; base64: string };
export interface ImageProvider { readonly name: string; readonly model: string; generate(input: ImageGenerationRequest): Promise<ImageGenerationResult>; }
