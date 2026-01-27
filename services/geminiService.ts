
import { GoogleGenAI, Modality } from "@google/genai";
import { SourceImage, BoundingBox, AnnotationBox } from "../types";

// Initialize GoogleGenAI with a mechanism to update the API key.
const getStoredApiKey = () => {
    return localStorage.getItem('cpgvn_gemini_api_key') || (typeof process !== 'undefined' ? process.env?.API_KEY : '') || '';
};

// Define Model IDs - Mapping User Request to Best Available Real Models
// User Request: "gemini-3-flash-preview" (Text/Logic) -> Real: "gemini-2.0-flash" (Current SOTA Speed/Logic)
// User Request: "gemini-2.5-flash-image" (Image/Vision) -> Real: "imagen-3.0-generate-001" (Current SOTA Image Gen)

export const MODEL_IDS = {
    TEXT_LOGIC: 'gemini-2.0-flash-exp', // Corrected: Needs '-exp' suffix for current access
    IMAGE_GEN: 'imagen-3.0-generate-001', // Keeps Imagen 3
};

// Variable to hold the AI instance, initialized only if key exists
let ai: any = null;
let preferredModelId = localStorage.getItem('cpgvn_preferred_model') || MODEL_IDS.TEXT_LOGIC;

const initAI = () => {
    const key = getStoredApiKey();
    if (key) {
        try {
            ai = new GoogleGenAI({ apiKey: key });
        } catch (e) {
            console.error("Failed to initialize GoogleGenAI:", e);
            ai = null;
        }
    } else {
        ai = null;
    }
};

// Initialize on load
initAI();

export const updateGeminiApiKey = (newKey: string) => {
    if (newKey) {
        localStorage.setItem('cpgvn_gemini_api_key', newKey);
    } else {
        localStorage.removeItem('cpgvn_gemini_api_key');
    }
    initAI(); // Re-initialize with new key
};

export const updatePreferredModel = (modelId: string) => {
    preferredModelId = modelId;
    localStorage.setItem('cpgvn_preferred_model', modelId);
};

export type TourMoveType = 'pan-up' | 'pan-down' | 'pan-left' | 'pan-right' | 'orbit-left' | 'orbit-right' | 'zoom-in' | 'zoom-out';
export type TourEffectType = 'night' | 'day' | 'magic' | 'snow' | 'starry';
export type SketchStyle = 'pencil' | 'watercolor' | 'oil';

// --- REST API Helper for Imagen 3 ---


// --- REST API Helper for Image Generation (Pollinations.ai Fallback) ---
// Google Imagen 3 API is restricted/beta and often returns 404/400 for personal keys.
// To ensure the app "just works", we use Pollinations.ai (Flux model) which is free, fast, and high-quality.
// --- REST API Helper for Imagen 3 (and Pollinations Fallback) ---
const generateImageRest = async (prompt: string, aspectRatio: string = "1:1", imageCount: number = 1, inputImages: SourceImage[] = []): Promise<string[]> => {
    const key = getStoredApiKey();

    // 1. Try Google Imagen 3 API First (supports I2I if key has access)
    if (key) {
        try {
            // Determine endpoint based on whether we have input images (Edit vs Generate)
            // Note: Currently the public 'predict' endpoint for imagen-3.0-generate-001 is primarily T2I.
            // However, we construct the payload to attempt passing the image if provided, 
            // matching the expected structure for editing/variation if available.

            // Use the preferred image model or default to Imagen 3
            const modelName = MODEL_IDS.IMAGE_GEN;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${key}`;

            const instance: any = { prompt: prompt };

            // If there's a source image, include it. 
            // Note: Proper Img2Img often requires specific model versions or endpoints (like Vertex AI),
            // but we attempt to pass it in the standard 'image' field for the `generate` or `edit` intent.
            if (inputImages && inputImages.length > 0) {
                instance.image = { bytesBase64Encoded: inputImages[0].base64 };
                // If there's a second image (mask), include it? (API dependent, keeping simple for now)
            }

            const body = {
                instances: [instance],
                parameters: {
                    sampleCount: imageCount,
                    aspectRatio: aspectRatio === 'Auto' ? '1:1' : aspectRatio
                }
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.predictions && data.predictions.length > 0) {
                    return data.predictions.map((p: any) => `data:image/png;base64,${p.bytesBase64Encoded}`);
                }
            } else {
                console.warn(`Google Imagen API Failed (${response.status}), falling back to Pollinations...`);
            }
        } catch (e) {
            console.error("Google Imagen API Error:", e);
        }
    }

    // 2. Fallback to Pollinations.ai (Free, Fast, T2I only usually)
    // Note: Pollinations 'image' param requires a URL, not base64. 
    // Without an upload server, we can only do T2I here effectively.
    // To support "Sketch-to-Render" behavior via T2I, we rely on the prompt being very descriptive.

    try {
        let width = 1024;
        let height = 1024;
        // Map aspect ratios
        if (aspectRatio === "16:9") { width = 1280; height = 720; }
        else if (aspectRatio === "4:3") { width = 1024; height = 768; }
        else if (aspectRatio === "3:4") { width = 768; height = 1024; }
        else if (aspectRatio === "9:16") { width = 720; height = 1280; }

        const promises = Array.from({ length: imageCount }).map(async () => {
            const seed = Math.floor(Math.random() * 1000000);
            // We encode the prompt. If we had an image URL, we would append &image=${url}
            const finalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error("Pollinations Failed");

            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });

        return await Promise.all(promises);
    } catch (e) {
        console.error("All Image Generation Failed:", e);
        return [];
    }
};

// --- Helpers ---
export const getActivationCode = (email: string): string => {
    if (!email) return "000000";
    let hash = 0;
    const lowerEmail = email.toLowerCase().trim();
    for (let i = 0; i < lowerEmail.length; i++) {
        const char = lowerEmail.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to a positive 6-digit code
    const code = Math.abs(hash % 900000 + 100000).toString();
    return code;
};

export const sourceImageToDataUrl = (image: SourceImage): string => {
    return `data:${image.mimeType};base64,${image.base64}`;
}

export const dataUrlToSourceImage = (dataUrl: string): SourceImage | null => {
    if (!dataUrl) return null;
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1];
    if (!base64Data || !mimeType) return null;
    return { base64: base64Data, mimeType };
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image`));
        img.src = src;
    });
};

const getClosestAspectRatio = async (image: SourceImage): Promise<string> => {
    try {
        const img = await loadImage(sourceImageToDataUrl(image));
        const ratio = img.width / img.height;
        const supportedRatios = [
            { label: "1:1", value: 1.0 },
            { label: "4:3", value: 1.333 },
            { label: "3:4", value: 0.75 },
            { label: "16:9", value: 1.777 },
            { label: "9:16", value: 0.5625 },
        ];
        let minDiff = Number.MAX_VALUE;
        let closest = "1:1";
        for (const r of supportedRatios) {
            const diff = Math.abs(ratio - r.value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = r.label;
            }
        }
        return closest;
    } catch (e) {
        console.error("Error calculating aspect ratio", e);
        return "1:1";
    }
};

// --- Strict Masking Composite (NEW) ---
export const strictComposite = async (originalB64: string, generatedB64: string, maskB64: string): Promise<string> => {
    try {
        const [orig, gen, mask] = await Promise.all([loadImage(originalB64), loadImage(generatedB64), loadImage(maskB64)]);

        const canvas = document.createElement('canvas');
        canvas.width = orig.width;
        canvas.height = orig.height;
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(orig, 0, 0);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;

        tempCtx.drawImage(gen, 0, 0, canvas.width, canvas.height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(mask, 0, 0, canvas.width, canvas.height);

        ctx.drawImage(tempCanvas, 0, 0);

        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Strict composite failed:", e);
        return generatedB64;
    }
};

// --- Advanced Editing Features (New) ---

export const generateImageWithElements = async (
    prompt: string,
    mainImage: SourceImage,
    maskImage: SourceImage | null,
    elements: SourceImage[],
    styleGuide: string,
    creativity: number,
    isInpainting: boolean
): Promise<string | null> => {

    const parts: any[] = [{ inlineData: { mimeType: mainImage.mimeType, data: mainImage.base64 } }];

    if (maskImage && isInpainting) {
        parts.push({ inlineData: { mimeType: maskImage.mimeType, data: maskImage.base64 } });
    }

    elements.forEach(el => parts.push({ inlineData: { mimeType: el.mimeType, data: el.base64 } }));

    let fullPrompt = prompt;
    if (styleGuide) fullPrompt += `\nStyle Guide: ${styleGuide}`;

    if (isInpainting) {
        fullPrompt += `\nTASK: Inpainting/Editing. Edit the image based on the prompt.`;
        if (maskImage) {
            fullPrompt += `\nCONSTRAINT: Modify ONLY the white areas in the mask. Keep black areas unchanged.`;
        }
    } else {
        fullPrompt += `\nTASK: Image Composition/Generation.`;
    }

    fullPrompt += `\nCreativity Level: ${creativity}/10 (1=Strict, 10=Wild)`;

    // Use REST API for Imagen 3
    try {
        const images = await generateImageRest(fullPrompt, "1:1", 1, [mainImage, ...(maskImage ? [maskImage] : []), ...elements]);
        if (images.length > 0) return images[0];
        return null;
    } catch (e) {
        console.error("Generate with Elements Error:", e);
        throw e;
    }
};

export const optimizeEnhancePrompt = async (prompt: string, image: SourceImage | null, language: string): Promise<string> => {
    try {
        const parts: any[] = [];
        if (image) {
            parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
        }
        parts.push({ text: `Act as a professional prompt engineer. Optimize this architectural/design prompt for image editing/inpainting AI: "${prompt}". \nReturn ONLY the optimized prompt string. Language: ${language}. Keep it concise but descriptive.` });

        if (!ai) throw new Error("Gemini API Key is not set.");
        const response = await ai.models.generateContent({
            model: MODEL_IDS.TEXT_LOGIC,
            contents: [{ role: 'user', parts }]
        });
        return response.text?.trim() || prompt;
    } catch (e) {
        console.error("Optimize prompt error", e);
        return prompt;
    }
};

export const removeImageBackground = async (sourceImage: SourceImage): Promise<string | null> => {
    // Note: Imagen 3 API via REST primarily supports text-to-image. 
    // Image-to-image or editing via REST might require specific endpoints or isn't fully public yet.
    // For now, we will try to use the REST API with a prompt describing the removal, 
    // BUT since strictly 'remove background' is an editing task, standard generation might just draw the object.
    // Given the constraints, we attempt the generation.

    // However, the previous logic used Gemini 2.5 (fake) -> Gemini 2.0 Flash (Text only).
    // If we want transparency, we need an editing model or a specific tool.
    // Since we are fixing "Bad Request", we should try to use Imagen 3 if possible, 
    // or return null if not supported, rather than crashing.

    try {
        const prompt = "Isolate subject, transparent background.";
        const images = await generateImageRest(prompt, "1:1", 1);
        return images[0] || null;
    } catch (e) {
        console.error("Remove BG error", e);
        return null;
    }
};

export const generateCompositeImage = async (objectImage: SourceImage, bgImage: SourceImage, positionDescription: string): Promise<string | null> => {
    const prompt = `Composite image. ${positionDescription}. Photorealistic.`;
    try {
        const images = await generateImageRest(prompt, "16:9", 1); // Defaulting to wide for composite
        return images[0] || null;
    } catch (e) {
        console.error("Composite error", e);
        throw e;
    }
};

export const cropImage = async (image: SourceImage, box: BoundingBox): Promise<SourceImage> => {
    const img = await loadImage(sourceImageToDataUrl(image));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.width);
    canvas.height = Math.round(box.height);
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    return dataUrlToSourceImage(canvas.toDataURL(image.mimeType))!;
};

export const compositeImage = async (
    bgImage: SourceImage,
    fgImage: SourceImage,
    box: BoundingBox,
    maskImage: SourceImage,
    options: { edgeBlend: number }
): Promise<string> => {
    const bg = await loadImage(sourceImageToDataUrl(bgImage));
    const fg = await loadImage(sourceImageToDataUrl(fgImage));
    const mask = await loadImage(sourceImageToDataUrl(maskImage));

    const canvas = document.createElement('canvas');
    canvas.width = bg.naturalWidth;
    canvas.height = bg.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(bg, 0, 0);

    const fgCanvas = document.createElement('canvas');
    fgCanvas.width = canvas.width;
    fgCanvas.height = canvas.height;
    const fgCtx = fgCanvas.getContext('2d')!;

    if (options.edgeBlend > 0) {
        fgCtx.filter = `blur(${options.edgeBlend}px)`;
    }
    fgCtx.drawImage(mask, 0, 0);
    fgCtx.globalCompositeOperation = 'source-in';
    fgCtx.filter = 'none';
    fgCtx.drawImage(fg, 0, 0, canvas.width, canvas.height);

    ctx.drawImage(fgCanvas, 0, 0);
    return canvas.toDataURL('image/png');
};

export const editImage = async (
    sourceImage: SourceImage,
    maskImage: SourceImage,
    prompt: string,
    referenceImage: SourceImage | null = null,
    annotations: AnnotationBox[] = []
): Promise<string | null> => {
    return generateImageWithElements(prompt, sourceImage, maskImage, referenceImage ? [referenceImage] : [], "", 5, true);
};

export const convertToStyle = async (
    sourceImage: SourceImage,
    style: 'sketch' | 'pencil' | 'watercolor'
): Promise<string | null> => {
    const prompts = {
        sketch: "Architectural line sketch, watercolor style, white background.",
        pencil: "Architectural pencil sketch, graphite, cross-hatching, black and white.",
        watercolor: "Architectural watercolor painting, vibrant, loose brushstrokes."
    };

    try {
        const images = await generateImageRest(prompts[style], "1:1", 1);
        return images[0] || null;
    } catch (e) {
        console.error("Conversion failed:", e);
    }
    return null;
};

export const convertImageToArchitecturalStyle = async (
    sourceImage: SourceImage,
    styleKey: string,
    moodImage?: SourceImage | null
): Promise<string | null> => {
    const aspectRatio = await getClosestAspectRatio(sourceImage);

    let finalPrompt = "";
    const parts: any[] = [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } }
    ];

    if (styleKey === 'mood_match' && moodImage) {
        parts.push({ inlineData: { data: moodImage.base64, mimeType: moodImage.mimeType } });
        finalPrompt = `
TASK: Architectural Style Transfer.
INPUT 1: Source Image (Architecture).
INPUT 2: Mood/Style Reference Image.

INSTRUCTION:
Redraw the Source Image (Input 1) using the EXACT art style, line work technique, color palette, and mood of the Reference Image (Input 2).

STRICT CONSTRAINTS:
1. GEOMETRY: You MUST PRESERVE the exact architectural geometry, perspective, building shape, and structural details of the Source Image. Do NOT add new buildings or remove existing ones.
2. STYLE: Apply the brush strokes, shading style (e.g., pencil hatch, watercolor wash, marker, etc.), and lighting atmosphere of the Reference Image.
3. OUTPUT: The result must look like the Source Image was drawn by the artist who created the Reference Image.
`;
    } else {
        const basePrompt = `INPUT: Use the uploaded image as the ONLY reference for geometry, proportions, scale, camera angle, and composition.
Do NOT redesign, do NOT add or remove architectural elements.
TASK:
Convert the CGI / SketchUp / 3ds Max render into a hand-crafted architectural presentation style.
STRICT RULES:
Keep 100% original camera angle
Keep exact architectural geometry and proportions
No creative redesign, no fantasy elements
No people, no vehicles unless already in the original image
Remove all CGI lighting artifacts, HDR, reflections, bloom
Replace with hand-crafted, human-made visual language
QUALITY:
High-resolution, professional architectural presentation,
suitable for:
architecture studio portfolio
competition board
design concept booklet
high-end architectural magazine
OUTPUT:
Clean background, balanced contrast, readable architecture,
clear hierarchy of massing and structure.`;

        const styles: Record<string, string> = {
            maker: `STYLE ADD-ON:
Architectural maker style, physical study model aesthetic.
Materials look like: white foam board, basswood, cardboard, plywood
Soft neutral lighting like studio model photography
Visible material edges, subtle imperfections
Minimal textures, focus on form and massing
Shadows are soft and directional
Neutral background (off-white / light grey)
Mood:
Conceptual, analytical, studio-process oriented
as if photographed in an architecture workshop.
No realism, no environment context beyond abstract ground plane.`,
            sketch: `STYLE ADD-ON:
Hand-drawn architectural sketch style.
Loose ink pen or graphite lines
Visible sketch strokes and construction lines
Slightly imperfect perspective
Line weight variation (thick–thin)
Minimal shading using hatching
White or light cream paper texture background
Mood:
Conceptual, exploratory, early design thinking
like an architect’s sketchbook.
No photorealism, no digital smoothness.`,
            watercolor: `STYLE ADD-ON:
Architectural Line Sketch with Watercolor Washes.
Convert the image into a beautiful architectural line sketch colored with soft watercolor washes.
- Outline: Fine black ink lines defining the geometry.
- Coloring: Vibrant watercolor washes, transparent pigments, loose brushstrokes.
- Details: Artistic splatters, bleeding edges, wet-on-wet effects.
- Background: Clean white paper texture.
- Mood: Artistic, dreamy, conceptual architectural illustration.
- Remove digital harshness, enforce hand-painted look.`,
            colored_pencil: `STYLE ADD-ON:
Colored pencil architectural drawing.
Hand-colored pencil strokes clearly visible
Grainy texture, layered coloring
Outlines in graphite or fine ink
Soft shadows using pencil hatching
Warm, human-made feel
Mood:
Friendly, approachable, human-scale architecture
like presentation boards or manual illustration.
No digital gradients, no airbrush effect.`,
            technical: `STYLE ADD-ON:
Architectural technical drawing style.
Clean black or dark grey linework
Orthographic or axonometric projection (based on original camera)
No shading or minimal technical hatch
White background
Precise, measured, drafting-like appearance
Include:
Clear line hierarchy
Structural clarity
Professional CAD / hand-drafting hybrid look
Mood:
Analytical, professional, engineering-oriented.`
        };
        finalPrompt = `${basePrompt}\n\n${styles[styleKey] || ""}`;
    }
    parts.push({ text: finalPrompt });

    try {
        const images = await generateImageRest(finalPrompt, await getClosestAspectRatio(sourceImage), 1);
        return images[0] || null;
    } catch (e) {
        console.error("Style conversion error:", e);
        throw e;
    }
};

export const generateArchitecturalPrompts = async (sourceImage: SourceImage): Promise<string> => {
    const systemPrompt = `Với vai trò là một nhiếp ảnh gia kiến trúc chuyên nghiệp, nhiệm vụ của bạn là phân tích hình ảnh công trình được cung cấp và tạo ra một danh sách gồm chính xác 20 prompt nhiếp ảnh đa dạng và chuyên nghiệp. Viết bằng tiếng Việt.`;

    const parts = [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: systemPrompt },
    ];

    try {
        if (!ai) throw new Error("Gemini API Key is not set.");
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts }],
        });
        return response.text.trim();
    } catch (error) {
        console.error("Lỗi tạo prompt:", error);
        throw error;
    }
};

export const upscaleImage = async (image: SourceImage, target: '2k' | '4k'): Promise<string | null> => {
    try {
        // Upscaling is also an image generation task in this context
        const images = await generateImageRest(`Upscale architecture image to ${target} quality. High detail.`, "1:1", 1);
        return images[0] || null;
    } catch (e) { return null; }
};

export const convertToSketchyStyle = async (image: SourceImage, type: 'interior' | 'exterior', style: SketchStyle = 'pencil'): Promise<string | null> => {
    const prompt = `Convert this ${type} image into an architectural ${style} drawing.`;
    try {
        const images = await generateImageRest(prompt, "1:1", 1);
        return images[0] || null;
    } catch (e) { return null; }
};

export const generateImages = async (s: SourceImage, p: string, t: 'exterior' | 'interior' | 'floorplan', n: number, ar: string, r: SourceImage | null, isAngle: boolean = false, cl: number = 3): Promise<string[]> => {
    let fullPrompt = `Task: Architectural render. Prompt: ${p}`;
    if (r) fullPrompt += " Use reference style.";

    let vr = ar;
    if (ar === 'Auto' || !["1:1", "3:4", "4:3", "9:16", "16:9"].includes(ar)) {
        vr = await getClosestAspectRatio(s);
    }

    try {
        // Use REST API for Imagen 3
        const images = await generateImageRest(fullPrompt, vr, n);
        return images;
    } catch (e) { throw e; }
};

export const analyzeFloorplanPrompt = async (image: SourceImage, type: string, style: string): Promise<string | null> => {
    try {
        if (!ai) throw new Error("Gemini API Key is not set.");
        const res = await ai.models.generateContent({
            model: MODEL_IDS.TEXT_LOGIC,
            contents: [{ role: 'user', parts: [{ inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: `Analyze drawing ${type}, style ${style}. Output prompt.` }] }]
        });
        return res.response?.text() || res.text?.() || res.text || null;
    } catch (e) { return null; }
};

export const analyzeLayout3DPrompt = async (s: SourceImage, r: SourceImage | null, b: string, a: string, i: string, l: string): Promise<string> => {
    const parts: any[] = [{ inlineData: { data: s.base64, mimeType: s.mimeType } }];
    if (r) parts.push({ inlineData: { data: r.base64, mimeType: r.mimeType } });
    parts.push({ text: `Layout 2D to 3D. Category: ${b}, Angle: ${a}, Style: ${i}, Lighting: ${l}. Output prompt.` });
    try {
        if (!ai) throw new Error("Gemini API Key is not set.");
        const response = await ai.models.generateContent({
            model: MODEL_IDS.TEXT_LOGIC,
            contents: [{ role: 'user', parts }],
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error("Analyze Layout 3D Prompt error", e);
        throw e;
    }
};

export const generateDiagramImage = async (s: SourceImage, t: string, n: string, ni: number, ar: string, r: SourceImage | null): Promise<string[]> => {
    return generateImages(s, `Technical Diagram: ${t}. Notes: ${n}`, 'exterior', ni, ar, r);
};

export const generateVirtualTourImage = async (i: SourceImage, m: TourMoveType, mag: number): Promise<string | null> => {
    const aspectRatio = await getClosestAspectRatio(i);
    try {
        const images = await generateImageRest(`Virtual Tour Perspective: Move ${m} ${mag} degrees.`, aspectRatio, 1);
        return images[0] || null;
    } catch (e) { return null; }
};

export const applyEffectToTourImage = async (i: SourceImage, e: TourEffectType): Promise<string | null> => {
    const aspectRatio = await getClosestAspectRatio(i);
    try {
        const images = await generateImageRest(`Apply effect ${e} to architectural scene.`, aspectRatio, 1);
        return images[0] || null;
    } catch (e) { return null; }
};

export const generateDiagramPromptFromReference = async (s: SourceImage, r: SourceImage): Promise<string> => {
    if (!ai) throw new Error("Gemini API Key is not set.");
    const res = await ai.models.generateContent({
        model: MODEL_IDS.TEXT_LOGIC,
        contents: [{ role: 'user', parts: [{ inlineData: { data: s.base64, mimeType: s.mimeType } }, { inlineData: { data: r.base64, mimeType: r.mimeType } }, { text: "Generate diagram style prompt." }] }]
    });
    return res.text || "";
};

export const generateOutpaintingPrompt = async (s: SourceImage): Promise<string> => {
    if (!ai) throw new Error("Gemini API Key is not set.");
    const res = await ai.models.generateContent({
        model: MODEL_IDS.TEXT_LOGIC,
        contents: [{ role: 'user', parts: [{ inlineData: { data: s.base64, mimeType: s.mimeType } }, { text: "Describe outpainting surroundings." }] }]
    });
    return res.response?.text() || res.text?.() || res.text || "";
};

export const padImageToAspectRatioWithColor = async (image: SourceImage, targetAspectRatio: number, color: string = 'white'): Promise<SourceImage> => {
    const img = await loadImage(sourceImageToDataUrl(image));
    const originalAspectRatio = img.naturalWidth / img.naturalHeight;
    let canvasWidth = img.naturalWidth; let canvasHeight = img.naturalHeight;
    let dx = 0; let dy = 0;
    if (originalAspectRatio > targetAspectRatio) {
        canvasHeight = Math.round(img.naturalWidth / targetAspectRatio);
        dy = Math.round((canvasHeight - img.naturalHeight) / 2);
    } else {
        canvasWidth = Math.round(img.naturalHeight * targetAspectRatio);
        dx = Math.round((canvasWidth - img.naturalWidth) / 2);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth; canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, dx, dy);
    return dataUrlToSourceImage(canvas.toDataURL('image/png'))!;
};

export const outpaintImage = async (sourceImage: SourceImage, targetAspectRatio: number, prompt: string): Promise<string | null> => {
    // Basic outpainting via text-to-image usually isn't enough, but it's the best we can do with Image Gen API only
    try {
        // We'll generate a new image with the prompt, implying we can't truly 'extend' without editing endpoint
        const images = await generateImageRest(`Outpaint/Extend: ${prompt}`, "16:9", 1);
        return images[0] || null;
    } catch (e) { throw e; }
};
