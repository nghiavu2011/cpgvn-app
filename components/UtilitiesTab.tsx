
import React, { useState, useEffect } from 'react';
import { Icon } from './icons';
import { Section, ImageUpload, ReferenceImageUpload, selectCommonStyles, ImageViewerModal, ImageCompareSlider } from './Shared';
import { HistoryPanel } from './HistoryPanel';
import { useLanguage } from './LanguageContext';
import { useToast } from './Toast';
import { RenderHistoryItem, SourceImage, GeneratedPrompts } from '../types';
import { 
    generateDiagramImage, 
    generateDiagramPromptFromReference, 
    outpaintImage,
    sourceImageToDataUrl,
    dataUrlToSourceImage,
    padImageToAspectRatioWithColor,
    generateOutpaintingPrompt,
    generateArchitecturalPrompts,
    convertImageToArchitecturalStyle
} from '../services/geminiService';

// --- Prompt Display Component ---
interface PromptDisplayProps {
    promptsText: string;
    onCopy: (text: string) => void;
    onGenerate: (text: string) => void;
}

const PromptDisplay: React.FC<PromptDisplayProps> = ({ promptsText, onCopy, onGenerate }) => {
    const lines = promptsText.split('\n').filter(line => line.trim() !== '');
    const headerKeywords = ['TOÀN CẢNH', 'TRUNG CẢNH', 'CẬN CẢNH', 'CINEMATIC'];

    return (
        <div className="space-y-3 text-[var(--text-secondary)]">
            {lines.map((line, index) => {
                const cleanLine = line.trim();
                const isHeader = headerKeywords.some(hk => cleanLine.toUpperCase().includes(hk));

                if (isHeader) {
                    return (
                        <h4 key={index} className="text-lg font-bold text-[var(--text-accent)] pt-6 pb-2 uppercase border-b border-[var(--border-accent)]/30 mb-2">
                            {cleanLine.replace(/\*/g, '')}
                        </h4>
                    );
                }

                const promptContent = cleanLine.startsWith('- ') ? cleanLine.substring(2).trim() : cleanLine.replace(/^\d+\.\s*/, '');

                if (!promptContent) return null;

                return (
                    <div key={index} className="group flex items-start justify-between gap-4 p-4 bg-[var(--bg-surface-2)] rounded-lg border border-[var(--border-2)] hover:border-[var(--border-interactive)] hover:bg-[var(--bg-surface-3)] transition-all">
                        <p className="text-sm flex-grow leading-relaxed text-[var(--text-primary)]">{promptContent}</p>
                        <div className="flex gap-2 shrink-0">
                            <button 
                                onClick={() => onCopy(promptContent)} 
                                className="p-2 bg-[var(--bg-surface-4)] rounded-md hover:text-[var(--text-accent)] transition-colors"
                                title="Sao chép"
                            >
                                <Icon name="clock" className="w-4 h-4" /> {/* Reusing clock icon as a clipboard-ish icon if none other exists, or use a better one */}
                            </button>
                            <button 
                                onClick={() => onGenerate(promptContent)} 
                                className="p-2 bg-[var(--bg-interactive)] text-white rounded-md hover:bg-[var(--bg-interactive-hover)] transition-colors"
                                title="Sử dụng để tạo ảnh"
                            >
                                <Icon name="sparkles" className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// --- Style Transfer Utility ---
interface StyleTransferUtilityProps {
    onBack: () => void;
}

const StyleTransferUtility: React.FC<StyleTransferUtilityProps> = ({ onBack }) => {
    const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
    const [selectedStyle, setSelectedStyle] = useState('maker');
    const [moodImage, setMoodImage] = useState<SourceImage | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const styles = [
        { id: 'maker', label: 'Mô Hình Maker', desc: 'Concept model, foam/bìa carton' },
        { id: 'sketch', label: 'Vẽ Tay Sketch', desc: 'Nét bút mực/chì, phác thảo' },
        { id: 'watercolor', label: 'Màu Nước', desc: 'Artistic, loang màu, mềm mại' },
        { id: 'colored_pencil', label: 'Bút Chì Màu', desc: 'Thân thiện, texture hạt giấy' },
        { id: 'technical', label: 'Bản Vẽ Kỹ Thuật', desc: 'Nét mảnh, chính xác, CAD-like' },
        { id: 'mood_match', label: 'Theo Ảnh Mood (Style Copy)', desc: 'Sao chép phong cách từ ảnh tham khảo' }
    ];

    const handleGenerate = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh gốc.' });
            return;
        }
        if (selectedStyle === 'mood_match' && !moodImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh Mood', message: 'Vui lòng tải lên ảnh Mood để sao chép phong cách.' });
            return;
        }

        setIsLoading(true);
        setResultImage(null);
        try {
            const result = await convertImageToArchitecturalStyle(sourceImage, selectedStyle, moodImage);
            if (result) {
                setResultImage(result);
                addToast({ type: 'success', title: 'Hoàn Tất', message: 'Đã chuyển đổi phong cách thành công.' });
            } else {
                throw new Error("Không nhận được ảnh kết quả.");
            }
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Lỗi', message: 'Quá trình chuyển đổi thất bại.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold">
                    <Icon name="arrow-uturn-left" className="w-5 h-5" />
                    Quay Lại Danh Sách
                </button>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Chuyển Style Ảnh (Style Transfer)</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <Section title="1. Tải Ảnh Gốc">
                        <ImageUpload
                            sourceImage={sourceImage}
                            onImageUpload={(img) => { setSourceImage(img); setResultImage(null); }}
                            onRemove={() => { setSourceImage(null); setResultImage(null); }}
                        />
                    </Section>

                    <Section title="2. Chọn Phong Cách">
                        <div className="space-y-3">
                            {styles.map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => setSelectedStyle(style.id)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                                        selectedStyle === style.id 
                                        ? 'bg-[var(--bg-interactive)]/20 border-[var(--border-interactive)] ring-1 ring-[var(--ring-active)]' 
                                        : 'bg-[var(--bg-surface-3)] border-[var(--border-2)] hover:bg-[var(--bg-surface-2)]'
                                    }`}
                                >
                                    <div className="font-bold text-[var(--text-primary)]">{style.label}</div>
                                    <div className="text-xs text-[var(--text-secondary)] opacity-80">{style.desc}</div>
                                </button>
                            ))}
                        </div>

                        {selectedStyle === 'mood_match' && (
                            <div className="mt-4 animate-slide-in-up">
                                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">Tải Ảnh Mood (Style Reference)</label>
                                <ReferenceImageUpload 
                                    image={moodImage}
                                    onUpload={setMoodImage}
                                    onRemove={() => setMoodImage(null)}
                                />
                                <p className="text-xs text-[var(--text-secondary)] mt-2 italic">
                                    Lưu ý: Hệ thống sẽ giữ nguyên hình khối công trình gốc và chỉ áp dụng màu sắc, nét vẽ từ ảnh Mood.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !sourceImage}
                            className="w-full mt-4 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                                <Icon name="brush" className="w-5 h-5" />
                            )}
                            {isLoading ? "Đang Chuyển Đổi..." : "Tạo Ảnh Mới"}
                        </button>
                    </Section>
                </div>

                <div className="lg:col-span-2">
                    <Section title="Kết Quả">
                        <div className="w-full aspect-video bg-black/20 rounded-lg flex items-center justify-center relative overflow-hidden min-h-[400px]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                    <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">AI đang vẽ lại theo phong cách đã chọn...</p>
                                </div>
                            ) : resultImage && sourceImage ? (
                                <ImageCompareSlider 
                                    beforeImage={sourceImageToDataUrl(sourceImage)} 
                                    afterImage={resultImage} 
                                />
                            ) : (
                                <div className="text-center text-[var(--text-tertiary)] opacity-50">
                                    <Icon name="photo" className="w-16 h-16 mx-auto mb-4" />
                                    <p>Kết quả sẽ hiển thị tại đây</p>
                                </div>
                            )}
                        </div>
                        {resultImage && (
                            <div className="mt-4 flex justify-end">
                                 <a 
                                    href={resultImage} 
                                    download={`CPGVN_StyleTransfer_${Date.now()}.png`} 
                                    className="bg-[var(--bg-interactive)] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[var(--bg-interactive-hover)] transition-colors"
                                >
                                    <Icon name="download" className="w-4 h-4" /> Tải Xuống
                                </a>
                            </div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
};

// --- Prompt Upgrade Utility ---
interface PromptUpgradeUtilityProps {
    onBack: () => void;
    sourceImage: SourceImage | null;
    setSourceImage: (img: SourceImage | null) => void;
    generatedPrompts: string;
    setGeneratedPrompts: (prompts: string) => void;
    onStartNewRenderFlow: (image: SourceImage, prompt: string) => void;
}

const PromptUpgradeUtility: React.FC<PromptUpgradeUtilityProps> = ({ 
    onBack, sourceImage, setSourceImage, generatedPrompts, setGeneratedPrompts, onStartNewRenderFlow 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const handleProcess = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh công trình cần phân tích.' });
            return;
        }

        setIsLoading(true);
        try {
            const result = await generateArchitecturalPrompts(sourceImage);
            setGeneratedPrompts(result);
            addToast({ type: 'success', title: 'Hoàn Tất', message: 'Đã tạo 20 gợi ý prompt chuyên nghiệp.' });
        } catch (error) {
            addToast({ type: 'error', title: 'Lỗi', message: 'Không thể phân tích ảnh lúc này.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast({ type: 'info', title: 'Đã Sao Chép', message: 'Prompt đã được lưu vào bộ nhớ tạm.' });
    };

    const handleGenerateRequest = (prompt: string) => {
        if (sourceImage) {
            onStartNewRenderFlow(sourceImage, prompt);
        }
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold">
                    <Icon name="arrow-uturn-left" className="w-5 h-5" />
                    Quay Lại Danh Sách
                </button>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Nâng Cấp Prompt Chuyên Nghiệp</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Section title="1. Ảnh Phân Tích">
                        <ImageUpload
                            sourceImage={sourceImage}
                            onImageUpload={setSourceImage}
                            onRemove={() => { setSourceImage(null); setGeneratedPrompts(""); }}
                        />
                        <button
                            onClick={handleProcess}
                            disabled={isLoading || !sourceImage}
                            className="w-full mt-6 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                                <Icon name="magnifying-glass-plus" className="w-5 h-5" />
                            )}
                            {isLoading ? "Đang phân tích ảnh..." : "Nâng Cấp Prompt"}
                        </button>
                    </Section>
                </div>

                <div className="lg:col-span-2">
                    <Section title="2. Danh Sách Gợi Ý (20 Prompts)">
                        {generatedPrompts ? (
                            <PromptDisplay 
                                promptsText={generatedPrompts} 
                                onCopy={handleCopy} 
                                onGenerate={handleGenerateRequest}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] opacity-30">
                                <Icon name="magnifying-glass-plus" className="w-20 h-20 mb-4" />
                                <p className="text-lg font-bold italic">Tải ảnh và nhấn phân tích để nhận gợi ý</p>
                            </div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
};

// --- Expand Image Utility ---
interface ExpandUtilityProps {
    onBack: () => void;
    onGenerationComplete: (prompt: string, images: string[]) => void;
}

const ExpandUtility: React.FC<ExpandUtilityProps> = ({ onBack, onGenerationComplete }) => {
    const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<number>(1.777); // Default 16:9
    const [aspectRatioLabel, setAspectRatioLabel] = useState("16:9");
    const [customPrompt, setCustomPrompt] = useState("");
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [expandHistory, setExpandHistory] = useState<RenderHistoryItem[]>([]);
    
    const { addToast } = useToast();
    const { t } = useLanguage();

    const ratios = [
        { label: "16:9 (Ngang)", value: 16/9 },
        { label: "9:16 (Dọc)", value: 9/16 },
        { label: "4:3 (Chuẩn)", value: 4/3 },
        { label: "3:4 (Dọc)", value: 3/4 },
        { label: "1:1 (Vuông)", value: 1 },
        { label: "21:9 (Điện ảnh)", value: 21/9 },
    ];

    // Generate preview whenever source image or aspect ratio changes
    useEffect(() => {
        let isMounted = true;
        const generatePreview = async () => {
            if (!sourceImage) {
                if(isMounted) setPreviewImage(null);
                return;
            }
            try {
                // Generate a preview with white padding to show what area will be expanded
                const padded = await padImageToAspectRatioWithColor(sourceImage, aspectRatio, 'white');
                if (isMounted) {
                    setPreviewImage(sourceImageToDataUrl(padded));
                }
            } catch (e) {
                console.error("Failed to generate preview", e);
            }
        };

        generatePreview();
        return () => { isMounted = false; };
    }, [sourceImage, aspectRatio]);

    const handleAutoPrompt = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh gốc.' });
            return;
        }
        setIsGeneratingPrompt(true);
        try {
            const prompt = await generateOutpaintingPrompt(sourceImage);
            setCustomPrompt(prompt);
            addToast({ type: 'success', title: 'Đã Tạo Gợi Ý', message: 'Đã tự động tạo mô tả cho phần mở rộng.' });
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Lỗi', message: 'Không thể tạo gợi ý.' });
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const handleGenerate = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh gốc.' });
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);

        try {
            const prompt = customPrompt || "Extend the scenery naturally.";
            const result = await outpaintImage(sourceImage, aspectRatio, prompt);
            
            if (result) {
                setResultImage(result);
                const newHistoryItem: RenderHistoryItem = { 
                    id: Date.now(), 
                    timestamp: new Date().toLocaleTimeString(), 
                    images: [result], 
                    prompt: `Expand ${aspectRatioLabel}: ${prompt}` 
                };
                setExpandHistory(prev => [newHistoryItem, ...prev]);
                onGenerationComplete(newHistoryItem.prompt, newHistoryItem.images);
            } else {
                throw new Error("AI did not return an image.");
            }
        } catch (error) {
            console.error("Failed to expand image:", error);
            addToast({ type: 'error', title: 'Lỗi', message: `Không thể mở rộng ảnh: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
             <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold">
                    <Icon name="arrow-uturn-left" className="w-5 h-5" />
                    Quay Lại Danh Sách
                </button>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('util_expand_title')}</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                    <Section title={t('util_expand_step1')}>
                        <ImageUpload
                            sourceImage={sourceImage}
                            onImageUpload={(img) => { setSourceImage(img); setResultImage(null); }}
                            onRemove={() => { setSourceImage(null); setResultImage(null); setPreviewImage(null); }}
                        />
                    </Section>
                    
                    <Section title={t('util_expand_step2')}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('util_expand_ratio')}</label>
                                <select 
                                    value={aspectRatio} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setAspectRatio(val);
                                        setAspectRatioLabel(e.target.options[e.target.selectedIndex].text);
                                        // Clear result when ratio changes to force preview
                                        if (resultImage) setResultImage(null); 
                                    }}
                                    className={selectCommonStyles}
                                    style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', }}
                                >
                                    {ratios.map((r, idx) => (
                                        <option key={idx} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                             <div className="relative">
                                <textarea 
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder={t('util_expand_prompt_ph')}
                                    className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none pr-10"
                                />
                                <button 
                                    onClick={handleAutoPrompt}
                                    disabled={isGeneratingPrompt || !sourceImage}
                                    className="absolute bottom-2 right-2 p-1.5 bg-[var(--bg-interactive)] text-white rounded-md hover:bg-[var(--bg-interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Tự động tạo gợi ý"
                                >
                                    {isGeneratingPrompt ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                    ) : (
                                        <Icon name="sparkles" className="w-4 h-4" />
                                    )}
                                </button>
                             </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !sourceImage}
                                className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                            >
                                <Icon name="arrows-pointing-out" className="w-5 h-5" />
                                {isLoading ? t('util_expand_generating') : t('util_expand_btn')}
                            </button>
                        </div>
                    </Section>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-8">
                    <Section title={t('res_title')}>
                        <div className="w-full bg-black/20 rounded-lg flex items-center justify-center min-h-[400px] relative">
                             {isLoading ? (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                    <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">{t('util_expand_generating')}</p>
                                </div>
                            ) : resultImage ? (
                                <div className="relative w-full h-full flex items-center justify-center p-4">
                                     <img src={resultImage} alt="Expanded Result" className="max-w-full max-h-[600px] object-contain rounded-md shadow-lg" />
                                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                                        <a href={resultImage} download={`CPGVN_Expanded_${Date.now()}.png`} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Tải ảnh">
                                            <Icon name="download" className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            ) : previewImage ? (
                                <div className="relative w-full h-full flex items-center justify-center p-4">
                                     {/* Display the padded preview so user sees the white space */}
                                     <img src={previewImage} alt="Preview with Padding" className="max-w-full max-h-[600px] object-contain rounded-md opacity-80" />
                                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">Preview (Vùng trắng sẽ được mở rộng)</span>
                                     </div>
                                </div>
                            ) : (
                                <div className="text-center text-[var(--text-tertiary)]">
                                    <Icon name="arrows-pointing-out" className="w-16 h-16 mx-auto mb-4" />
                                    <p>{t('res_empty')}</p>
                                </div>
                            )}
                        </div>
                    </Section>
                    
                    <HistoryPanel 
                        title="Lịch Sử Mở Rộng" 
                        history={expandHistory} 
                        onClear={() => setExpandHistory([])} 
                        onSelect={(item) => setResultImage(item.images[0])} 
                        emptyText={t('hist_empty')} 
                    />
                </div>
            </div>
        </div>
    );
};

// --- Diagram Utility ---
interface DiagramUtilityProps {
    onBack: () => void;
    sourceImage: SourceImage | null;
    setSourceImage: (image: SourceImage | null) => void;
    diagramReferenceImage: SourceImage | null;
    setDiagramReferenceImage: (image: SourceImage | null) => void;
    diagramResults: string[];
    setDiagramResults: (images: string[]) => void;
    onGenerationComplete: (prompt: string, images: string[]) => void;
    diagramHistory: RenderHistoryItem[];
    onClearDiagramHistory: () => void;
}

const DiagramUtility: React.FC<DiagramUtilityProps> = ({ 
    onBack, sourceImage, setSourceImage, diagramReferenceImage, setDiagramReferenceImage, diagramResults, setDiagramResults, onGenerationComplete, diagramHistory, onClearDiagramHistory 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingAutoPrompt, setIsLoadingAutoPrompt] = useState(false);
    const [selectedType, setSelectedType] = useState("");
    const [customNotes, setCustomNotes] = useState("");
    const [numImages, setNumImages] = useState(1);
    const [aspectRatio, setAspectRatio] = useState('Auto');
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

    const { addToast } = useToast();
    const { t } = useLanguage();

    // Reset index when results change
    useEffect(() => {
        setSelectedImageIndex(0);
    }, [diagramResults]);

    // Prompt specifically for following reference style
    const REF_STYLE_PROMPT = "Analyze the provided reference image (the second image). Apply its exact architectural illustration style, color palette, line weight, and diagrammatic technique to the source building. Do not change the geometry of the source building, only the presentation style.";

    const diagramTypes = [
        {
            value: REF_STYLE_PROMPT,
            label: "Theo ảnh tham khảo (Follow Reference Image)"
        },
        {
            value: "Tạo một axonometric exploded diagram từ ảnh render này. Giữ đúng hình khối và tỷ lệ công trình gốc. Xây dựng lại mô hình dưới dạng axonometric và tách thành các lớp: – mái – tầng trên – tầng dưới – mặt sàn – nền/đế. Hiển thị các lớp theo dạng exploded view với đường dẫn chấm thẳng đứng. Nét mảnh, đồng đều, độ rõ cao, đơn giản hóa chi tiết nhưng giữ đúng hình học. Thêm nhãn chú thích Mặt bằng tầng 1,2,3 theo thứ tự từ dưới lên. Không thêm chi tiết mới ngoài hình gốc.",
            label: t('util_diagram_type_exploded')
        },
        {
            value: "Tạo một concept diagram kiến trúc bằng cách vẽ các đường sketch, nét bút chì và ghi chú lên trên ảnh render này. Giữ nguyên hình ảnh gốc và thêm các yếu tố diagram như: – mũi tên tay vẽ (hand-drawn arrows) – vòng cung chỉ hướng – ký hiệu ánh sáng, gió, mặt trời – ghi chú text ngắn mô tả công năng, hướng gió, ánh sáng, lối vào, khoảng mở – khung chữ viết tay (handwritten annotation boxes) – đường nét trắng nhẹ, phong cách schematic architectural diagram. Phong cách: giống bản phác thảo kiến trúc sư trên mô hình, nét tự nhiên, mềm, hơi nguệch ngoạc nhưng thẩm mỹ. Không làm thay đổi hình khối công trình trong ảnh gốc. Không thêm chi tiết mới, chỉ overlay diagram lên trên. Kết quả: một concept architectural diagram đẹp, trực quan, giống bản viết tay minh họa ý tưởng.",
            label: t('util_diagram_type_analysis')
        },
        {
            value: "Biến ảnh đầu vào thành phong cách biểu diễn kiến trúc dạng diagram. Giữ công trình chính nổi bật với màu sắc vật liệu phong cách technical illustration, đường nét sạch, mô hình hóa theo dạng 3D massing. Render theo phong cách axonometric / isometric. Làm mờ và giản lược toàn bộ bối cảnh xung quanh thành các khối trắng tinh, ít chi tiết, viền mảnh. Nhà cửa, đường phố, cây xanh chuyển thành tone trắng – xám nhạt như mô hình study mass. Tập trung thể hiện rõ hình khối kiến trúc chính, các đường cong, tầng setback, ban công, cửa sổ trình bày bằng các đường line đều và tối giản. Loại bỏ texture thực tế, ánh sáng mềm, không đổ bóng mạnh. Phong cách tổng thể giống mô hình concept kiến trúc, minimal, clean, high-level design diagram",
            label: t('util_diagram_type_axo')
        }
    ];

    const handleAutoGeneratePrompt = async () => {
        if (!sourceImage || !diagramReferenceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên cả ảnh công trình và ảnh tham khảo.' });
            return;
        }
        setIsLoadingAutoPrompt(true);
        try {
            const prompt = await generateDiagramPromptFromReference(sourceImage, diagramReferenceImage);
            setCustomNotes(prompt);
            addToast({ type: 'success', title: 'Thành Công', message: 'Đã tạo prompt từ ảnh tham khảo. Bạn có thể nhấn Tạo Diagram ngay.' });
        } catch (error) {
            console.error("Failed to auto-generate prompt:", error);
            addToast({ type: 'error', title: 'Lỗi', message: 'Không thể tạo prompt tự động.' });
        } finally {
            setIsLoadingAutoPrompt(false);
        }
    };

    const handleGenerate = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh công trình.' });
            return;
        }

        // Validation for "Follow Reference Image"
        if (selectedType === REF_STYLE_PROMPT && !diagramReferenceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh Tham Khảo', message: 'Bạn đã chọn "Theo ảnh tham khảo", vui lòng tải lên ảnh tham khảo ở mục bên trên.' });
            return;
        }
        
        if (!selectedType && !customNotes.trim()) {
            addToast({ type: 'warning', title: 'Thiếu Thông Tin', message: 'Vui lòng chọn loại diagram hoặc nhập/tạo ghi chú.' });
            return;
        }

        setIsLoading(true);
        setDiagramResults([]);

        try {
            const results = await generateDiagramImage(sourceImage, selectedType, customNotes, numImages, aspectRatio, diagramReferenceImage);
            if (results && results.length > 0) {
                setDiagramResults(results);
                
                let historyLabel = "";
                if (selectedType === REF_STYLE_PROMPT) {
                    historyLabel = "Theo ảnh tham khảo";
                } else if (selectedType) {
                    // Truncate long prompts for display
                    historyLabel = selectedType.substring(0, 30) + "...";
                } else {
                    historyLabel = "Custom Diagram";
                }
                
                if (customNotes) historyLabel += " + Notes";
                
                onGenerationComplete(historyLabel, results);
            } else {
                throw new Error("AI did not return any images.");
            }
        } catch (error) {
            console.error("Failed to generate diagram:", error);
            addToast({ type: 'error', title: 'Lỗi', message: `Đã xảy ra lỗi: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setIsLoading(false);
        }
    };

    const renderOptionsUI = (
        <div className="grid grid-cols-2 gap-4 my-4">
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('opt_num_images')}</label>
                <div className="flex items-center gap-2 bg-[var(--bg-surface-3)] rounded-md p-1">
                    {[1, 2, 4].map(n => (
                        <button key={n} onClick={() => setNumImages(n)} className={`w-full text-sm font-semibold py-1.5 rounded-md transition-colors ${numImages === n ? 'bg-[var(--bg-interactive)] text-[var(--text-interactive)] shadow' : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}>{n}</button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('opt_aspect_ratio')}</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={selectCommonStyles} style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', }}>
                    <option value="Auto">{t('opt_auto')}</option>
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                </select>
            </div>
        </div>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold">
                    <Icon name="arrow-uturn-left" className="w-5 h-5" />
                    Quay Lại Danh Sách
                </button>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('util_diagram_title')}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                    <Section title={t('util_diagram_step1')}>
                        <ImageUpload
                            sourceImage={sourceImage}
                            onImageUpload={setSourceImage}
                            onRemove={() => { setSourceImage(null); setDiagramResults([]); }}
                        />
                        <div className="mt-4">
                            <ReferenceImageUpload 
                                image={diagramReferenceImage}
                                onUpload={setDiagramReferenceImage}
                                onRemove={() => setDiagramReferenceImage(null)}
                            />
                        </div>
                    </Section>
                    <Section title={t('util_diagram_step2')}>
                        <div className="space-y-4">
                            <select 
                                value={selectedType} 
                                onChange={(e) => setSelectedType(e.target.value)} 
                                className={`${selectCommonStyles} pr-10`}
                                style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                            >
                                <option value="">{t('util_diagram_select_ph')}</option>
                                {diagramTypes.map((type, idx) => (
                                    <option key={idx} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                            
                            <div className="relative">
                                <textarea 
                                    value={customNotes}
                                    onChange={(e) => setCustomNotes(e.target.value)}
                                    placeholder={t('util_diagram_notes_ph')}
                                    className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none pr-10"
                                />
                                <button 
                                    onClick={handleAutoGeneratePrompt}
                                    disabled={isLoadingAutoPrompt || !sourceImage || !diagramReferenceImage}
                                    className="absolute bottom-2 right-2 p-1.5 bg-[var(--bg-interactive)] text-white rounded-md hover:bg-[var(--bg-interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Tạo prompt tự động từ ảnh tham khảo và ảnh gốc"
                                >
                                    {isLoadingAutoPrompt ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                    ) : (
                                        <Icon name="sparkles" className="w-4 h-4" />
                                    )}
                                </button>
                            </div>

                            {renderOptionsUI}

                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !sourceImage || (!selectedType && !customNotes)}
                                className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                            >
                                <Icon name="sparkles" className="w-5 h-5" />
                                {isLoading ? t('util_diagram_generating') : t('util_diagram_btn')}
                            </button>
                        </div>
                    </Section>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-8">
                    <Section title={t('res_title')}>
                        <div className="w-full aspect-[4/3] bg-black/20 rounded-lg flex items-center justify-center min-h-[400px] relative group">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                    <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">{t('util_diagram_generating')}</p>
                                </div>
                            ) : diagramResults.length > 0 ? (
                                <>
                                    <img src={diagramResults[selectedImageIndex]} alt="Diagram Result" className="w-full h-full object-contain rounded-md" />
                                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                        <button onClick={() => setFullscreenImage(diagramResults[selectedImageIndex])} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Phóng To">
                                            <Icon name="arrows-expand" className="w-4 h-4" />
                                        </button>
                                        <a href={diagramResults[selectedImageIndex]} download={`CPGVN_Diagram_${Date.now()}.png`} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Tải ảnh">
                                            <Icon name="download" className="w-4 h-4" />
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-[var(--text-tertiary)]">
                                    <Icon name="rectangle-group" className="w-16 h-16 mx-auto mb-4" />
                                    <p>{t('res_empty')}</p>
                                </div>
                            )}
                        </div>
                        {diagramResults.length > 0 && (
                            <div className="relative z-10 grid gap-3 mt-4" style={{gridTemplateColumns: `repeat(${Math.min(diagramResults.length, 4)}, minmax(0, 1fr))`}}>
                                {diagramResults.map((image, index) => (
                                    <div
                                        key={index}
                                        className={`relative group aspect-square bg-[var(--bg-surface-2)] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-surface-1)] ring-[var(--ring-active)]' : 'opacity-70 hover:opacity-100'}`}
                                        onClick={() => setSelectedImageIndex(index)}
                                    >
                                        <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                    <HistoryPanel title={t('hist_diagram')} history={diagramHistory} onClear={onClearDiagramHistory} onSelect={() => {}} emptyText={t('hist_empty')} />
                </div>
            </div>
            {fullscreenImage && (
                <ImageViewerModal images={[fullscreenImage]} startIndex={0} onClose={() => setFullscreenImage(null)}/>
            )}
        </div>
    );
};

// --- Main UtilitiesTab Router ---

interface UtilitiesTabProps {
    onEditRequest: (image: string) => void;
    onStartNewRenderFlow: (image: SourceImage, prompt: string) => void;
    promptFinderImage: SourceImage | null;
    setPromptFinderImage: (img: SourceImage | null) => void;
    promptFinderPrompts: string; // Use string for analysis results
    setPromptFinderPrompts: (prompts: string) => void;
    finishMyBuildImage: SourceImage | null;
    setFinishMyBuildImage: (img: SourceImage | null) => void;
    finishMyBuildPrompts: string[] | null;
    setFinishMyBuildPrompts: (prompts: string[] | null) => void;
    finishInteriorImage: SourceImage | null;
    setFinishInteriorImage: (img: SourceImage | null) => void;
    finishInteriorPrompts: string[] | null;
    setFinishInteriorPrompts: (prompts: string[] | null) => void;
    mapTo3DImage: SourceImage | null;
    setMapTo3DImage: (img: SourceImage | null) => void;
    presentationBoardImage: SourceImage | null;
    setPresentationBoardImage: (img: SourceImage | null) => void;
    presentationBoardResults: string[];
    setPresentationBoardResults: (imgs: string[]) => void;
    presentationBoardHistory: RenderHistoryItem[];
    onClearPresentationBoardHistory: () => void;
    diagramImage: SourceImage | null;
    setDiagramImage: (img: SourceImage | null) => void;
    diagramReferenceImage: SourceImage | null;
    setDiagramReferenceImage: (img: SourceImage | null) => void;
    diagramResults: string[];
    setDiagramResults: (imgs: string[]) => void;
    diagramHistory: RenderHistoryItem[];
    onClearDiagramHistory: () => void;
    history: RenderHistoryItem[];
    onClearHistory: () => void;
    onGenerationComplete: (prompt: string, images: string[]) => void;
    initialUtility: string | null;
    setInitialUtility: (util: string | null) => void;
    videoTabSourceImage: SourceImage | null;
    setVideoTabSourceImage: (img: SourceImage | null) => void;
}

export const UtilitiesTab: React.FC<UtilitiesTabProps> = (props) => {
    const [activeUtility, setActiveUtility] = useState<string | null>(props.initialUtility);
    const { t } = useLanguage();
    const { addToast } = useToast();

    // Effect to sync initial utility if it changes (e.g. from redirect)
    useEffect(() => {
        if (props.initialUtility) {
            setActiveUtility(props.initialUtility);
            props.setInitialUtility(null); // Clear after setting
        }
    }, [props.initialUtility, props]);

    const UtilityCard: React.FC<{ id: string; title: string; desc: string; icon: string; }> = ({ id, title, desc, icon }) => (
        <button
            onClick={() => setActiveUtility(id)}
            className="flex flex-col items-start p-6 bg-[var(--bg-surface-2)] border border-[var(--border-2)] rounded-xl hover:border-[var(--border-interactive)] hover:bg-[var(--bg-surface-3)] transition-all text-left group h-full"
        >
            <div className="p-3 bg-[var(--bg-surface-1)] rounded-lg mb-4 text-[var(--text-interactive)] group-hover:scale-110 transition-transform">
                <Icon name={icon} className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{desc}</p>
        </button>
    );

    if (activeUtility === 'diagram') {
        return <DiagramUtility 
            onBack={() => setActiveUtility(null)}
            sourceImage={props.diagramImage}
            setSourceImage={props.setDiagramImage}
            diagramReferenceImage={props.diagramReferenceImage}
            setDiagramReferenceImage={props.setDiagramReferenceImage}
            diagramResults={props.diagramResults}
            setDiagramResults={props.setDiagramResults}
            onGenerationComplete={props.onGenerationComplete}
            diagramHistory={props.diagramHistory}
            onClearDiagramHistory={props.onClearDiagramHistory}
        />;
    }

    if (activeUtility === 'expand_image') {
        return <ExpandUtility
            onBack={() => setActiveUtility(null)}
            onGenerationComplete={props.onGenerationComplete}
        />
    }

    if (activeUtility === 'prompt_upgrade') {
        return <PromptUpgradeUtility
            onBack={() => setActiveUtility(null)}
            sourceImage={props.promptFinderImage}
            setSourceImage={props.setPromptFinderImage}
            generatedPrompts={props.promptFinderPrompts}
            setGeneratedPrompts={props.setPromptFinderPrompts}
            onStartNewRenderFlow={props.onStartNewRenderFlow}
        />
    }

    if (activeUtility === 'style_transfer') {
        return <StyleTransferUtility onBack={() => setActiveUtility(null)} />;
    }

    if (activeUtility) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                 <button onClick={() => setActiveUtility(null)} className="self-start mb-4 flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <Icon name="arrow-uturn-left" className="w-5 h-5" /> Quay Lại
                </button>
                <div className="p-8 bg-[var(--bg-surface-2)] rounded-xl border border-[var(--border-2)] max-w-md">
                    <Icon name="beaker" className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)]" />
                    <h2 className="text-xl font-bold mb-2">Tính năng đang phát triển</h2>
                    <p className="text-[var(--text-secondary)]">Tiện ích này sẽ sớm ra mắt trong bản cập nhật tiếp theo.</p>
                </div>
            </div>
        );
    }

    // Menu View
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
             <UtilityCard 
                id="prompt_upgrade" 
                title="Nâng Cấp Prompt" 
                desc="Gợi ý 20 prompt nhiếp ảnh kiến trúc chuyên nghiệp từ hình ảnh thực tế." 
                icon="magnifying-glass-plus" 
            />
            <UtilityCard 
                id="style_transfer" 
                title="Chuyển Style Ảnh" 
                desc="Biến ảnh render thành các phong cách diễn họa: Maker, Sketch, Màu nước..." 
                icon="brush" 
            />
            <UtilityCard 
                id="diagram" 
                title={t('util_diagram_title')} 
                desc={t('util_diagram_desc')} 
                icon="rectangle-group" 
            />
             <UtilityCard 
                id="expand_image" 
                title={t('util_expand_title')} 
                desc={t('util_expand_desc')} 
                icon="arrows-pointing-out" 
            />
            <UtilityCard 
                id="presentation" 
                title={t('util_presentation_title')} 
                desc={t('util_presentation_desc')} 
                icon="bookmark" 
            />
            <UtilityCard 
                id="mood_board" 
                title="Mood Board Generator" 
                desc={t('guide_utils_mood')} 
                icon="photo" 
            />
             <UtilityCard 
                id="finish_build" 
                title="Finish My Build" 
                desc={t('guide_utils_finish')} 
                icon="home" 
            />
             <UtilityCard 
                id="create_video" 
                title="AI Video Generator" 
                desc="Tạo video ngắn từ hình ảnh hoặc mô tả." 
                icon="film" 
            />
        </div>
    );
};
