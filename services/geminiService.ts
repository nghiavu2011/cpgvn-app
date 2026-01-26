
import { GoogleGenAI, Modality } from "@google/genai";
import { SourceImage, BoundingBox, AnnotationBox } from "../types";

// Initialize GoogleGenAI with a mechanism to update the API key.
const getStoredApiKey = () => {
    return localStorage.getItem('cpgvn_gemini_api_key') || process.env.API_KEY || '';
};

let ai = new GoogleGenAI({ apiKey: getStoredApiKey() });

export const updateGeminiApiKey = (newKey: string) => {
    if (newKey) {
        localStorage.setItem('cpgvn_gemini_api_key', newKey);
    } else {
        localStorage.removeItem('cpgvn_gemini_api_key');
    }
    ai = new GoogleGenAI({ apiKey: getStoredApiKey() });
};

export type TourMoveType = 'pan-up' | 'pan-down' | 'pan-left' | 'pan-right' | 'orbit-left' | 'orbit-right' | 'zoom-in' | 'zoom-out';
export type TourEffectType = 'night' | 'day' | 'magic' | 'snow' | 'starry';
export type SketchStyle = 'pencil' | 'watercolor' | 'oil';

export { AnnotationBox };

// --- Helpers ---
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
// This function ensures that the generated image is ONLY applied where the mask exists.
// Everything outside the mask is forced to remain exactly as the original image.
export const strictComposite = async (originalB64: string, generatedB64: string, maskB64: string): Promise<string> => {
    try {
        const [orig, gen, mask] = await Promise.all([loadImage(originalB64), loadImage(generatedB64), loadImage(maskB64)]);

        const canvas = document.createElement('canvas');
        canvas.width = orig.width;
        canvas.height = orig.height;
        const ctx = canvas.getContext('2d')!;

        // 1. Draw the absolute original first (Background)
        ctx.drawImage(orig, 0, 0);

        // 2. Create a temporary canvas to hold the "masked generated content"
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;

        // Draw the AI generated image
        tempCtx.drawImage(gen, 0, 0, canvas.width, canvas.height);

        // Apply the mask as an alpha channel
        // 'destination-in': The existing content is kept where it overlaps the new shape. 
        // Everything else becomes transparent.
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(mask, 0, 0, canvas.width, canvas.height);

        // 3. Draw the masked AI content on top of the original
        ctx.drawImage(tempCanvas, 0, 0);

        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Strict composite failed:", e);
        return generatedB64; // Fallback to raw generation if composite fails
    }
};

// --- Advanced Editing Features (New) ---

// 1. Hàm chính: Chỉnh sửa ảnh (Inpainting/Editing/Element Injection)
export const generateImageWithElements = async (
    prompt: string,
    mainImage: SourceImage,
    maskImage: SourceImage | null,
    elements: SourceImage[],
    styleGuide: string,
    creativity: number, // 1-10
    isInpainting: boolean
): Promise<string | null> => {

    const parts: any[] = [{ inlineData: { mimeType: mainImage.mimeType, data: mainImage.base64 } }];

    // Nếu có mask, thêm mask vào (cho inpainting truyền thống)
    if (maskImage && isInpainting) {
        parts.push({ inlineData: { mimeType: maskImage.mimeType, data: maskImage.base64 } });
    }

    // Thêm các layer vật thể phụ (nếu có) - Element Injection
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

    parts.push({ text: fullPrompt });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Model tốt nhất cho chỉnh sửa
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        });

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    } catch (e) {
        console.error("Generate with Elements Error:", e);
        throw e;
    }
    return null;
};

// 2. Tối ưu Prompt
export const optimizeEnhancePrompt = async (prompt: string, image: SourceImage | null, language: string): Promise<string> => {
    try {
        const parts: any[] = [];
        if (image) {
            parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
        }
        parts.push({ text: `Act as a professional prompt engineer. Optimize this architectural/design prompt for image editing/inpainting AI: "${prompt}". \nReturn ONLY the optimized prompt string. Language: ${language}. Keep it concise but descriptive.` });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts }
        });
        return response.text?.trim() || prompt;
    } catch (e) {
        console.error("Optimize prompt error", e);
        return prompt;
    }
};

// 3. Xóa nền (Remove Background)
export const removeImageBackground = async (sourceImage: SourceImage): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.base64 } },
                    { text: "Remove the background from this image. Return ONLY the subject on a transparent background (PNG)." }
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    } catch (e) {
        console.error("Remove BG error", e);
        throw e;
    }
    return null;
};

// 4. Hòa trộn (Magic Mix / Composite)
export const generateCompositeImage = async (objectImage: SourceImage, bgImage: SourceImage, positionDescription: string): Promise<string | null> => {
    const prompt = `Composite the object image into the background image. ${positionDescription}. Blend lighting, shadows, and perspective realistically.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: bgImage.mimeType, data: bgImage.base64 } },
                    { inlineData: { mimeType: objectImage.mimeType, data: objectImage.base64 } },
                    { text: prompt }
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    } catch (e) {
        console.error("Composite error", e);
        throw e;
    }
    return null;
};

// --- Legacy & Utilities ---

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
    // Wrapper for the old call to use the new generic function if desired, 
    // or keep separate. For now, we keep separate to ensure backward compatibility 
    // while the ImageEditor is being rewritten.
    return generateImageWithElements(prompt, sourceImage, maskImage, referenceImage ? [referenceImage] : [], "", 5, true);
};

export const convertToStyle = async (
    sourceImage: SourceImage,
    style: 'sketch' | 'pencil' | 'watercolor'
): Promise<string | null> => {
    const prompts = {
        sketch: "Convert this photorealistic image into a beautiful architectural line sketch colored with soft watercolor washes. Background white.",
        pencil: "Convert this image into a professional hand-drawn pencil architectural sketch using graphite lines and cross-hatching. Black and white only.",
        watercolor: "Convert this image into a vibrant architectural watercolor painting with loose brushstrokes and artistic splatters."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
                    { text: prompts[style] },
                ],
            },
            config: { responseModalities: [Modality.IMAGE] },
        });

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: { aspectRatio: aspectRatio as any }
            }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
        console.error("Style conversion error:", e);
        throw e;
    }
}

export const generateArchitecturalPrompts = async (sourceImage: SourceImage): Promise<string> => {
    const systemPrompt = `Với vai trò là một nhiếp ảnh gia kiến trúc chuyên nghiệp, nhiệm vụ của bạn là phân tích hình ảnh công trình được cung cấp và tạo ra một danh sách gồm chính xác 20 prompt nhiếp ảnh đa dạng và chuyên nghiệp.
    
    ĐỊNH DẠNG TRẢ VỀ (Bắt buộc):
    **TOÀN CẢNH**
    - [Prompt 1]
    - [Prompt 2]
    - [Prompt 3]
    - [Prompt 4]
    - [Prompt 5]
    **TRUNG CẢNH**
    - [Prompt 6]
    - [Prompt 7]
    - [Prompt 8]
    - [Prompt 9]
    - [Prompt 10]
    **CẬN CẢNH**
    - [Prompt 11]
    - [Prompt 12]
    - [Prompt 13]
    - [Prompt 14]
    - [Prompt 15]
    **CINEMATIC**
    - [Prompt 16]
    - [Prompt 17]
    - [Prompt 18]
    - [Prompt 19]
    - [Prompt 20]
    
    Lưu ý: Chỉ trả về danh sách, không thêm lời dẫn. Viết bằng tiếng Việt.`;

    const parts = [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: systemPrompt },
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Lỗi tạo prompt:", error);
        throw error;
    }
};

export const upscaleImage = async (image: SourceImage, target: '2k' | '4k'): Promise<string | null> => {
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: `Upscale to ${target}` }] }
        });
        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : null;
    } catch (e) { return null; }
};

export const convertToSketchyStyle = async (image: SourceImage, type: 'interior' | 'exterior', style: SketchStyle = 'pencil'): Promise<string | null> => {
    const prompt = `Convert this ${type} image into an architectural ${style} drawing.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: prompt }] }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : null;
    } catch (e) { return null; }
};

export const generateImages = async (s: SourceImage, p: string, t: 'exterior' | 'interior' | 'floorplan', n: number, ar: string, r: SourceImage | null, isAngle: boolean = false, cl: number = 3): Promise<string[]> => {
    const parts: any[] = [{ inlineData: { data: s.base64, mimeType: s.mimeType } }];
    if (r) parts.push({ inlineData: { data: r.base64, mimeType: r.mimeType } }, { text: "Use reference style." });
    parts.push({ text: `Task: Architectural render. Prompt: ${p}` });

    let vr = ar;
    if (ar === 'Auto' || !["1:1", "3:4", "4:3", "9:16", "16:9"].includes(ar)) {
        vr = await getClosestAspectRatio(s);
    }

    try {
        const promises = Array.from({ length: n }).map(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image', contents: { parts }, config: { imageConfig: { aspectRatio: vr as any } }
        }));
        const results = await Promise.all(promises);
        return results.map(res => {
            const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
            return part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : "";
        }).filter(Boolean);
    } catch (e) { throw e; }
};

export const analyzeFloorplanPrompt = async (image: SourceImage, type: string, style: string): Promise<string | null> => {
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { data: image.base64, mimeType: image.mimeType } }, { text: `Analyze drawing ${type}, style ${style}. Output prompt.` }] }
        });
        return res.text || null;
    } catch (e) { return null; }
};

export const analyzeLayout3DPrompt = async (s: SourceImage, r: SourceImage | null, b: string, a: string, i: string, l: string): Promise<string> => {
    const parts: any[] = [{ inlineData: { data: s.base64, mimeType: s.mimeType } }];
    if (r) parts.push({ inlineData: { data: r.base64, mimeType: r.mimeType } });
    parts.push({ text: `Layout 2D to 3D. Category: ${b}, Angle: ${a}, Style: ${i}, Lighting: ${l}. Output prompt.` });
    const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts } });
    return res.text?.trim() || "";
};

export const generateDiagramImage = async (s: SourceImage, t: string, n: string, ni: number, ar: string, r: SourceImage | null): Promise<string[]> => {
    return generateImages(s, `Technical Diagram: ${t}. Notes: ${n}`, 'exterior', ni, ar, r);
};

export const generateVirtualTourImage = async (i: SourceImage, m: TourMoveType, mag: number): Promise<string | null> => {
    const aspectRatio = await getClosestAspectRatio(i);
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { data: i.base64, mimeType: i.mimeType } }, { text: `Move ${m} ${mag} deg.` }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any } }
    });
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : null;
};

export const applyEffectToTourImage = async (i: SourceImage, e: TourEffectType): Promise<string | null> => {
    const aspectRatio = await getClosestAspectRatio(i);
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { data: i.base64, mimeType: i.mimeType } }, { text: `Apply effect ${e}` }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any } }
    });
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : null;
};

export const generateDiagramPromptFromReference = async (s: SourceImage, r: SourceImage): Promise<string> => {
    const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data: s.base64, mimeType: s.mimeType } }, { inlineData: { data: r.base64, mimeType: r.mimeType } }, { text: "Generate diagram style prompt." }] }
    });
    return res.text || "";
};

export const generateOutpaintingPrompt = async (s: SourceImage): Promise<string> => {
    const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data: s.base64, mimeType: s.mimeType } }, { text: "Describe outpainting surroundings." }] }
    });
    return res.text || "";
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
    const img = await loadImage(sourceImageToDataUrl(sourceImage));
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
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = canvasWidth; imageCanvas.height = canvasHeight;
    const imgCtx = imageCanvas.getContext('2d')!;
    imgCtx.fillStyle = 'black'; imgCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    imgCtx.drawImage(img, dx, dy);
    const paddedBase64 = imageCanvas.toDataURL('image/png').split(',')[1];
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasWidth; maskCanvas.height = canvasHeight;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.fillStyle = 'white'; maskCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    maskCtx.fillStyle = 'black'; maskCtx.fillRect(dx, dy, img.naturalWidth, img.naturalHeight);
    const maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { data: paddedBase64, mimeType: 'image/png' } }, { inlineData: { data: maskBase64, mimeType: 'image/png' } }, { text: `Outpaint Task: ${prompt}` }] }
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            const resultImg = await loadImage(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvasWidth; finalCanvas.height = canvasHeight;
            const fCtx = finalCanvas.getContext('2d')!;
            fCtx.drawImage(resultImg, 0, 0, canvasWidth, canvasHeight);
            fCtx.drawImage(img, dx, dy);
            return finalCanvas.toDataURL('image/png');
        }
    } catch (e) { throw e; }
    return null;
};
