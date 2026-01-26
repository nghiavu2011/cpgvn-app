
export interface RenderHistoryItem {
  id: number;
  timestamp: string;
  images: string[];
  prompt: string;
}

export interface EditHistoryItem {
  id: number;
  timestamp: string;
  sourceImage: SourceImage;
  maskImage: SourceImage;
  prompt: string;
  resultImage: string;
}

export interface Layout3DHistoryItem {
  id: number;
  timestamp: string;
  sourceImage: SourceImage;
  images: string[];
  style: string;
  quality: string;
  tone: string;
}

export interface SourceImage {
  base64: string;
  mimeType: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationBox extends BoundingBox {
  id: number;
}

export interface EditorAsset {
  id: string;
  type: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

export interface EditorState {
  mode: 'brush' | 'eraser' | 'move' | 'asset';
  brushSize: number;
  assets: EditorAsset[];
}

export interface GeneratedPrompts {
  medium: string[];
  closeup: string[];
  interior: string[];
}

export interface RenderTabState {
  sourceImage: SourceImage | null;
  sketchyImage: SourceImage | null;
  referenceImage: SourceImage | null;
  generatedImages: string[];
  selectedImageIndex: number;
  useSketchyStyle: boolean;
  creativityLevel: number; // 1 to 5
}

// New Types for Advanced Editor
export type ToolMode = 'brush' | 'eraser';
// Language type is already defined in components/LanguageContext, but referenced here in legacy code
// We will use string for now or import it where needed.

export interface HistoryItem {
    id: string;
    result: string;
    original: string;
    timestamp: number;
}

export interface GenerationState {
    originalImage: string | null;
    originalMimeType: string;
    maskedImage: string | null;
    compositeImage: string | null;
    prompt: string;
    aspectRatio: string;
    creativity: number;
    isProcessing: boolean;
    history: HistoryItem[];
    canvasWidth: number;
    canvasHeight: number;
}
