
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    generateImageWithElements, 
    optimizeEnhancePrompt,
    strictComposite
} from '../services/geminiService';
import InpaintingModal, { InpaintingModalRef } from './InpaintingModal';
import ImageComparison from './ImageComparison';
import GuideModal from './GuideModal';
import { Icon } from './icons';
import { GenerationState, ToolMode, HistoryItem, SourceImage, EditHistoryItem } from '../types';
import { useLanguage } from './LanguageContext';

// Helper for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

const MAX_CANVAS_WIDTH = 1200; 
const MAX_CANVAS_HEIGHT = 1000;
const RATIOS = ['original', '1:1', '16:9', '9:16', '2:3', '3:2', '4:3', '3:4'];

// Defined Palette for Numbered Brushing
const BRUSH_COLORS = [
    { id: 1, color: '#ef4444', label: 'Red' },    // 1: Red
    { id: 2, color: '#3b82f6', label: 'Blue' },   // 2: Blue
    { id: 3, color: '#22c55e', label: 'Green' },  // 3: Green
    { id: 4, color: '#eab308', label: 'Yellow' }, // 4: Yellow
    { id: 5, color: '#a855f7', label: 'Purple' }  // 5: Purple
];

// Helper Sub-component for buttons
const ToolButton = ({ icon, label, isActive, onClick }: { icon: string | React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
    <div className="relative group">
        <button 
            onClick={onClick}
            className={`p-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
            {typeof icon === 'string' ? <Icon name={icon} className="w-5 h-5" /> : icon}
        </button>
        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {label}
        </span>
    </div>
);

interface ImageEditorProps {
    initialImage: SourceImage | null;
    onClearInitialImage: () => void;
    onEditComplete: (details: {
        sourceImage: SourceImage;
        maskImage: SourceImage;
        prompt: string;
        resultImage: string;
    }) => void;
    historyItemToRestore: EditHistoryItem | null;
    onHistoryRestored: () => void;
    onCreateVideoRequest: (imageUrl: string) => void;
    onImageGenerated: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
    initialImage,
    onClearInitialImage,
    onEditComplete,
    historyItemToRestore,
    onHistoryRestored,
    onImageGenerated
}) => {
    const { t, setLanguage, language } = useLanguage();

    // --- State ---
    const [state, setState] = useState<GenerationState>({
        originalImage: null,
        originalMimeType: '',
        maskedImage: null,
        compositeImage: null,
        prompt: "",
        aspectRatio: 'original',
        creativity: 5,
        isProcessing: false,
        history: [], 
        canvasWidth: 800,
        canvasHeight: 800
    });

    const [activeMode, setActiveMode] = useState<ToolMode>('brush');
    const [brushSize, setBrushSize] = useState(20);
    const [brushOpacity, setBrushOpacity] = useState(0.4); 
    const [activeColorId, setActiveColorId] = useState<number>(1); 
    const [isDragging, setIsDragging] = useState(false);
    
    const [comparisonData, setComparisonData] = useState<{ before: string, after: string } | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    
    const canvasRef = useRef<InpaintingModalRef>(null);

    const activeColor = BRUSH_COLORS.find(c => c.id === activeColorId)?.color || '#ef4444';

    // Sync Props
    useEffect(() => {
        if (initialImage) {
            const img = new Image();
            img.onload = () => {
                let newWidth = img.width;
                let newHeight = img.height;
                const aspectRatio = img.width / img.height;

                if (newWidth > MAX_CANVAS_WIDTH || newHeight > MAX_CANVAS_HEIGHT) {
                    if (newWidth / MAX_CANVAS_WIDTH > newHeight / MAX_CANVAS_HEIGHT) {
                        newWidth = MAX_CANVAS_WIDTH;
                        newHeight = MAX_CANVAS_WIDTH / aspectRatio;
                    } else {
                        newHeight = MAX_CANVAS_HEIGHT;
                        newWidth = MAX_CANVAS_HEIGHT * aspectRatio;
                    }
                }

                setState(prev => ({ 
                    ...prev, 
                    originalImage: `data:${initialImage.mimeType};base64,${initialImage.base64}`,
                    originalMimeType: initialImage.mimeType,
                    canvasWidth: Math.round(newWidth),
                    canvasHeight: Math.round(newHeight),
                    // Reset other states
                    maskedImage: null,
                    compositeImage: null,
                    resultImage: null
                }));
            };
            img.src = `data:${initialImage.mimeType};base64,${initialImage.base64}`;
        }
    }, [initialImage]);

    // Restore History Logic from Props
    useEffect(() => {
        if (historyItemToRestore) {
            const img = new Image();
            const src = `data:${historyItemToRestore.sourceImage.mimeType};base64,${historyItemToRestore.sourceImage.base64}`;
            img.onload = () => {
                setState(prev => ({
                    ...prev,
                    originalImage: src,
                    originalMimeType: historyItemToRestore.sourceImage.mimeType,
                    prompt: historyItemToRestore.prompt,
                    canvasWidth: img.width,
                    canvasHeight: img.height
                }));
            };
            img.src = src;
            onHistoryRestored();
        }
    }, [historyItemToRestore, onHistoryRestored]);

    // --- Actions ---

    const handleReset = (skipConfirm: boolean = false) => {
        if (!skipConfirm && state.originalImage && !window.confirm(t('confirmNew') || "Bạn có chắc muốn tạo mới?")) {
            return;
        }
        
        setState({
            originalImage: null,
            originalMimeType: '',
            maskedImage: null,
            compositeImage: null,
            prompt: "",
            aspectRatio: 'original',
            creativity: 5,
            isProcessing: false,
            history: [],
            canvasWidth: 800,
            canvasHeight: 800
        });
        setActiveMode('brush');
        setActiveColorId(1);
        onClearInitialImage();
    };

    const handleDownloadCurrent = () => {
        if (canvasRef.current) {
            const { composite } = canvasRef.current.snapshot();
            const link = document.createElement('a');
            // If there's a result available (in comparisonData or history), allow downloading that.
            // Otherwise fallback to composite (which is just the background if no edit happened yet)
            // But usually we want to download the RESULT of the edit.
            
            // Check if we have a recent result
            let downloadUrl = composite;
            if (state.history.length > 0) {
                // If history exists, prefer the latest result
                downloadUrl = state.history[0].result;
            }

            link.href = downloadUrl;
            link.download = `cpg-edit-${Date.now()}.png`;
            link.click();
        }
    };

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            alert("Please upload a valid image file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            
            const img = new Image();
            img.onload = () => {
                let newWidth = img.width;
                let newHeight = img.height;
                const aspectRatio = img.width / img.height;

                if (newWidth > MAX_CANVAS_WIDTH || newHeight > MAX_CANVAS_HEIGHT) {
                    if (newWidth / MAX_CANVAS_WIDTH > newHeight / MAX_CANVAS_HEIGHT) {
                        newWidth = MAX_CANVAS_WIDTH;
                        newHeight = MAX_CANVAS_WIDTH / aspectRatio;
                    } else {
                        newHeight = MAX_CANVAS_HEIGHT;
                        newWidth = MAX_CANVAS_HEIGHT * aspectRatio;
                    }
                }

                setState(prev => ({ 
                    ...prev, 
                    originalImage: result,
                    originalMimeType: file.type,
                    canvasWidth: Math.round(newWidth),
                    canvasHeight: Math.round(newHeight)
                }));
            };
            img.src = result;
        };
        reader.readAsDataURL(file);
    }, [state.canvasWidth, state.canvasHeight]);

    // --- Event Listeners ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.clipboardData && e.clipboardData.items) {
                for (let i = 0; i < e.clipboardData.items.length; i++) {
                    const item = e.clipboardData.items[i];
                    if (item.type.indexOf("image") !== -1) {
                        const file = item.getAsFile();
                        if (file) processFile(file);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [processFile]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const handleGenerate = async () => {
        if (!canvasRef.current || !state.originalImage) return;
        setState(prev => ({ ...prev, isProcessing: true }));

        try {
            // Snapshot gives us the background and the mask (B/W mask for AI)
            // Note: mask string here is a data URL of the B/W mask
            const { composite, mask } = canvasRef.current.snapshot();
            
            // Inpainting is true if there is a mask
            // Simple check on mask data length or content
            const isInpainting = !!(mask && mask.length > 1000); 
            
            const elements: SourceImage[] = [];
            let maskImage: SourceImage | null = null;

            if (mask && isInpainting) {
                const maskB64 = mask.split(',')[1];
                if(maskB64) {
                    maskImage = { base64: maskB64, mimeType: 'image/png' };
                }
            }

            const mainImage: SourceImage = { base64: state.originalImage.split(',')[1], mimeType: 'image/png' };

            // 1. Generate via AI
            const generatedResponse = await generateImageWithElements(
                state.prompt,
                mainImage, 
                maskImage,
                elements,
                "photorealistic, 8k, high detail, professional photography",
                state.creativity,
                isInpainting
            );

             if (generatedResponse) {
                 // 2. Strict Compositing: Enforce strict masking
                 // Even if AI hallucinates outside mask, this will fix it.
                 let finalResult = generatedResponse;
                 if (isInpainting && mask) {
                     finalResult = await strictComposite(state.originalImage, generatedResponse, mask);
                 }

                 // 3. Update History
                 const newItem: HistoryItem = {
                     id: generateId(),
                     result: finalResult,
                     original: state.originalImage, // Keep original background as reference
                     timestamp: Date.now()
                 };

                 setState(prev => ({
                     ...prev,
                     history: [newItem, ...prev.history]
                 }));

                 onEditComplete({
                    sourceImage: mainImage,
                    maskImage: maskImage || { base64: '', mimeType: 'image/png' },
                    prompt: state.prompt,
                    resultImage: finalResult
                 });
                 onImageGenerated();
                 
                 // Show comparison immediately
                 setComparisonData({ before: state.originalImage, after: finalResult });
             }

        } catch (error) {
            console.error("Generation failed", error);
            alert("Generation failed. Please try again or check console.");
        } finally {
            setState(prev => ({ ...prev, isProcessing: false }));
        }
    };

    const handleOptimizePrompt = async () => {
        if (!state.prompt || !state.originalImage) return;
        setState(prev => ({ ...prev, isProcessing: true }));
        try {
            const langName = language === 'vi' ? 'Vietnamese' : 'English';
            const optimized = await optimizeEnhancePrompt(state.prompt, { base64: state.originalImage.split(',')[1], mimeType: 'image/png' }, langName);
            setState(prev => ({ ...prev, prompt: optimized }));
        } catch (e) {
            console.error(e);
        } finally {
            setState(prev => ({ ...prev, isProcessing: false }));
        }
    };

    return (
        <div 
            className="flex flex-col lg:flex-row h-[800px] bg-gray-950 text-gray-200 font-sans overflow-hidden rounded-xl border border-[var(--border-1)] shadow-2xl relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* --- Global Loading Overlay --- */}
            {state.isProcessing && (
                <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-wider animate-pulse">{t('btn_converting') || "Processing..."}</h2>
                </div>
            )}

            {/* --- Drag Overlay --- */}
            {isDragging && !state.isProcessing && (
                <div className="absolute inset-0 bg-indigo-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-3xl pointer-events-none">
                    <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce">
                        <Icon name="photo" className="w-16 h-16 text-indigo-400 mb-4" />
                        <h2 className="text-2xl font-bold text-white">{t('drag_drop')}</h2>
                    </div>
                </div>
            )}

            {/* --- Comparison Modal --- */}
            {comparisonData && (
                <ImageComparison 
                    before={comparisonData.before} 
                    after={comparisonData.after} 
                    onClose={() => setComparisonData(null)} 
                />
            )}
            
            {/* --- User Guide Modal --- */}
            {showGuide && (
                <GuideModal onClose={() => setShowGuide(false)} />
            )}

            {/* --- LEFT PANEL: History --- */}
            <div className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col z-10">
                 <div className="flex border-b border-gray-800 p-4 items-center gap-2">
                    <Icon name="clock" className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-bold tracking-wide text-gray-200 uppercase">{t('hist_edit')}</span>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    <div className="space-y-3">
                        {state.history.length === 0 && (
                            <div className="text-center py-10 text-gray-600 text-xs whitespace-pre-line">
                                {t('hist_empty')}
                            </div>
                        )}
                        {state.history.map((item, i) => (
                            <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 group">
                                <div className="relative aspect-video bg-gray-900">
                                    <img src={item.result} className="w-full h-full object-cover" alt="result" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button 
                                            onClick={() => setComparisonData({ before: item.original, after: item.result })}
                                            className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-full text-white shadow-lg transform hover:scale-105 transition"
                                            title={t('res_zoom')}
                                        >
                                            <Icon name="arrows-right-left" className="w-4 h-4" />
                                        </button>
                                        <a 
                                            href={item.result} 
                                            download={`cpg-edit-${i}.jpg`}
                                            className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white shadow-lg transition"
                                            title={t('btn_download')}
                                        >
                                            <Icon name="download" className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                                <div className="p-2 flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                    <button 
                                        onClick={() => {
                                            const img = new Image();
                                            img.onload = () => {
                                                    setState(prev => ({ 
                                                        ...prev, 
                                                        originalImage: item.result, // Load result as new base for further editing
                                                        maskedImage: null, 
                                                        canvasWidth: img.width,
                                                        canvasHeight: img.height
                                                    }));
                                            };
                                            img.src = item.result;
                                        }}
                                        className="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition"
                                    >
                                        {t('res_edit')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>

            {/* --- CENTER: Workspace --- */}
            <div className="flex-1 flex flex-col relative min-w-0 bg-gray-950">
                {/* Header */}
                <header className="h-14 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex items-center justify-between px-4 z-20">
                    <h2 className="text-sm font-bold tracking-wide text-gray-200 uppercase flex items-center gap-2">
                        <Icon name="brush" className="w-5 h-5 text-indigo-400" />
                        {t('guide_edit_title')}
                    </h2>
                    <div className="flex items-center gap-2">
                        {state.originalImage && (
                            <button 
                                onClick={handleDownloadCurrent}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition border border-gray-700"
                                title="Tải ảnh hiện tại"
                            >
                                <Icon name="download" className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('btn_download')}</span>
                            </button>
                        )}
                        <button 
                            onClick={() => handleReset(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shadow-lg shadow-indigo-500/20"
                        >
                            <Icon name="x-mark" className="w-4 h-4" />
                            <span>{t('btn_remove')}</span>
                        </button>
                    </div>
                </header>

                {/* Canvas Area */}
                <main className="flex-1 overflow-hidden relative p-4 flex items-center justify-center">
                    {!state.originalImage ? (
                         <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-800 rounded-3xl bg-gray-900/30 text-center max-w-md">
                            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                <Icon name="photo" className="w-8 h-8 text-gray-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t('guide_edit_title')}</h2>
                            <p className="text-gray-400 mb-8">{t('drag_drop')}</p>
                            <label className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-3 rounded-xl font-bold cursor-pointer transition shadow-xl">
                                {t('btn_upload')}
                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                            </label>
                         </div>
                    ) : (
                        <div className="relative w-full h-full">
                            <InpaintingModal 
                                key={state.originalImage} 
                                ref={canvasRef}
                                width={state.canvasWidth}
                                height={state.canvasHeight}
                                backgroundImage={state.originalImage}
                                mode={activeMode}
                                brushSize={brushSize}
                                brushOpacity={brushOpacity}
                                activeColor={activeColor}
                                onSnapshot={() => {}}
                            />
                        </div>
                    )}
                </main>

                {/* --- FLOATING TOOLBAR --- */}
                {state.originalImage && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                        <div className="flex items-center gap-1 bg-gray-900/90 backdrop-blur-md border border-gray-700 p-1.5 rounded-2xl shadow-2xl">
                            
                            <ToolButton icon={<Icon name="brush" />} label="Cọ Vẽ" isActive={activeMode === 'brush'} onClick={() => setActiveMode('brush')} />
                            <ToolButton icon={<Icon name="x-mark" />} label="Tẩy" isActive={activeMode === 'eraser'} onClick={() => setActiveMode('eraser')} />
                            
                            {/* Numbered Brush Palette */}
                            {activeMode === 'brush' && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-xl ml-1 border border-gray-700 animate-in fade-in slide-in-from-left-2">
                                    {BRUSH_COLORS.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveColorId(item.id)}
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 ${
                                                activeColorId === item.id 
                                                ? 'ring-2 ring-white scale-110 shadow-lg' 
                                                : 'opacity-70 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: item.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                                            title={`${item.label}`}
                                        >
                                            {item.id}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Brush Settings */}
                            <div className="flex items-center gap-3 px-3 py-1 bg-gray-800 rounded-xl ml-1 border border-gray-700">
                                {/* Size */}
                                <div className="flex items-center gap-2" title="Brush Size">
                                    <div className="w-4 h-4 rounded-full border border-gray-500 flex items-center justify-center bg-gray-700">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" max="200" 
                                        value={brushSize} 
                                        onChange={(e) => setBrushSize(Number(e.target.value))}
                                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>
                                {/* Opacity */}
                                <div className="flex items-center gap-2" title="Brush Opacity">
                                        <div className="w-4 h-4 rounded-full border border-gray-500 flex items-center justify-center bg-gray-700">
                                        <div className="w-3 h-3 bg-white/50 rounded-full" />
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" max="100" 
                                        value={brushOpacity * 100} 
                                        onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
                                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="w-px h-6 bg-gray-700 mx-1" />
                            <ToolButton icon={<Icon name="arrow-uturn-left" />} label="Undo" isActive={false} onClick={() => canvasRef.current?.undo()} />
                            <button 
                                onClick={() => canvasRef.current?.clearMask()}
                                className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                                title={t('btn_remove')}
                            >
                                <Icon name="trash" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- RIGHT PANEL: Generation Controls --- */}
            <div className="w-72 border-l border-gray-800 bg-gray-900 p-6 flex flex-col z-10 overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                    <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-4">{t('genSettings')}</h2>
                    
                    {/* Prompt */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-400">{t('textPrompt')}</label>
                            <button onClick={handleOptimizePrompt} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition uppercase font-medium tracking-wide">
                                <Icon name="sparkles" className="w-3 h-3" /> {t('enhance')}
                            </button>
                        </div>
                        <textarea 
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32 text-gray-200 placeholder-gray-600 shadow-inner"
                            placeholder={t('promptPlaceholder')}
                            value={state.prompt}
                            onChange={(e) => setState(prev => ({ ...prev, prompt: e.target.value }))}
                        />
                        <p className="text-[10px] text-gray-500 mt-2">
                           {t('promptHint')}
                        </p>
                    </div>
                    
                    {/* Aspect Ratio */}
                    <div className="mb-6">
                        <label className="text-xs font-semibold text-gray-400 mb-2 block">{t('opt_aspect_ratio')}</label>
                        <div className="grid grid-cols-3 gap-2">
                             {RATIOS.slice(0, 6).map(ratio => (
                                 <button
                                    key={ratio}
                                    onClick={() => setState(prev => ({ ...prev, aspectRatio: ratio }))}
                                    className={`px-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                                        state.aspectRatio === ratio 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                    }`}
                                 >
                                    {ratio === 'original' ? 'Gốc' : ratio}
                                 </button>
                             ))}
                        </div>
                    </div>

                    {/* Creativity */}
                    <div className="mb-8">
                         <div className="flex justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-400">{t('creativity')}</label>
                            <span className="text-xs text-indigo-400 font-mono">{state.creativity}/10</span>
                        </div>
                        <input 
                            type="range" min="1" max="10" 
                            value={state.creativity}
                            onChange={(e) => setState(prev => ({ ...prev, creativity: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                        />
                    </div>
                </div>

                {/* Generate Action - Sticky Bottom */}
                <div className="mt-auto">
                    <button 
                        onClick={handleGenerate}
                        disabled={state.isProcessing || !state.originalImage}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95"
                    >
                        {state.isProcessing ? (
                            <>{t('btn_converting')}</>
                        ) : (
                            <><Icon name="sparkles" className="w-5 h-5" /> {t('btn_generate')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
