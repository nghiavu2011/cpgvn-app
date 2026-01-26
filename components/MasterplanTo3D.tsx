
import React, { useState, useEffect } from 'react';
import { Icon } from './icons';
import { Section, ImageUpload, ReferenceImageUpload, ResultDisplay } from './Shared';
import { HistoryPanel } from './HistoryPanel';
import { generateImages, analyzeFloorplanPrompt } from '../services/geminiService';
import { useToast } from './Toast';
import type { SourceImage, RenderHistoryItem } from '../types';

export const MasterplanTo3D: React.FC<{
    history: RenderHistoryItem[];
    onGenerationComplete: (prompt: string, images: string[]) => void;
    onClearHistory: () => void;
    onEditRequest: (imageUrl: string) => void;
}> = ({ history, onGenerationComplete, onClearHistory, onEditRequest }) => {
    // --- State Management ---
    const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
    const [referenceImage, setReferenceImage] = useState<SourceImage | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    
    const [masterplanStyle, setMasterplanStyle] = useState('Ảnh chụp thực tế công trình');
    const [masterplanContext, setMasterplanContext] = useState('');
    const [masterplanLighting, setMasterplanLighting] = useState('');
    const [masterplanTone, setMasterplanTone] = useState('');
    const [masterplanPrompt, setMasterplanPrompt] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [numImages, setNumImages] = useState(2);
    const [aspectRatio, setAspectRatio] = useState('Auto');
    const { addToast } = useToast();

    // --- Options Data ---
    const styleOptions = ["Ảnh chụp thực tế công trình", "Ảnh render Vray", "Mô hình kiến trúc", "Ảnh vẽ tay nghệ thuật"];
    const contextOptions = ["Khu đô thị hiện đại", "Vùng nông thôn xanh mát", "Khu resort ven biển", "Trung tâm thành phố sầm uất", "Khu công nghiệp", "Vùng núi cao thơ mộng"];
    const lightingOptions = ["Ánh sáng hoàng hôn", "Bầu trời u ám", "Trưa nắng gắt", "Bình minh", "Ban đêm có đèn"];
    const toneOptions = ["Tự nhiên", "Ấm áp", "Lạnh hiện đại", "Điện ảnh", "Vintage"];

    // --- Logic: Tự động cập nhật Prompt khi đổi Option ---
    useEffect(() => {
        const parts = [
            masterplanStyle,
            "Biến bản vẽ mặt bằng tổng thể này thành ảnh phối cảnh 3D thực tế từ trên cao.",
            masterplanContext ? `Bối cảnh: ${masterplanContext}` : "",
            masterplanLighting ? `Ánh sáng: ${masterplanLighting}` : "",
            masterplanTone ? `Tone màu: ${masterplanTone}` : ""
        ].filter(p => p !== "");
        setMasterplanPrompt(parts.join('. '));
    }, [masterplanStyle, masterplanContext, masterplanLighting, masterplanTone]);

    // --- Action: Phân tích Prompt bằng AI ---
    const handleAnalyze = async () => {
        if (!sourceImage) {
            addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải ảnh masterplan lên trước.' });
            return;
        }
        setIsAnalyzing(true);
        try {
            const result = await analyzeFloorplanPrompt(sourceImage, "Mặt bằng tổng thể", masterplanStyle);
            if (result) setMasterplanPrompt(result + ". Phối cảnh chim bay từ trên cao.");
        } catch (e) {
            addToast({ type: 'error', title: 'Lỗi', message: 'Không thể phân tích ảnh.' });
        } finally { setIsAnalyzing(false); }
    };

    // --- Action: Tạo ảnh chính ---
    const handleGenerate = async () => {
        if (!sourceImage) return;
        setIsLoading(true);
        try {
            const images = await generateImages(sourceImage, masterplanPrompt, 'floorplan', numImages, aspectRatio, referenceImage, false);
            setGeneratedImages(images);
            onGenerationComplete(masterplanPrompt, images);
        } catch (e) {
            addToast({ type: 'error', title: 'Thất Bại', message: 'Lỗi khi tạo ảnh 3D.' });
        } finally { setIsLoading(false); }
    };

    const selectClass = "w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm text-[var(--text-primary)] border border-[var(--border-2)] appearance-none focus:outline-none focus:ring-2 focus:ring-yellow-500";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
            {/* CỘT TRÁI - INPUT */}
            <div className="lg:col-span-1 space-y-6">
                <Section title="1. Tải Lên Masterplan">
                    <ImageUpload sourceImage={sourceImage} onImageUpload={setSourceImage} onRemove={() => {setSourceImage(null); setGeneratedImages([]);}} />
                </Section>

                <Section title="2. Mô Tả & Tùy Chọn">
                    <div className="space-y-4">
                        <label className="text-sm text-gray-400">Ảnh tham khảo (Tùy chọn)</label>
                        <ReferenceImageUpload image={referenceImage} onUpload={setReferenceImage} onRemove={() => setReferenceImage(null)} />

                        <div>
                            <label className="block text-sm mb-2 text-[var(--text-secondary)]">Style ảnh</label>
                            <select value={masterplanStyle} onChange={e => setMasterplanStyle(e.target.value)} className={selectClass}>
                                {styleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <button onClick={handleAnalyze} disabled={isAnalyzing || !sourceImage} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] text-yellow-500 text-xs font-bold py-2.5 rounded-md transition-all border border-yellow-500/30">
                            {isAnalyzing ? "Đang phân tích..." : <><Icon name="sparkles" className="w-4 h-4"/> Phân Tích & Hoàn Thiện Prompt</>}
                        </button>

                        <textarea 
                            value={masterplanPrompt} 
                            onChange={e => setMasterplanPrompt(e.target.value)}
                            className="w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm h-32 resize-none border border-[var(--border-2)] text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                            placeholder="Mô tả phối cảnh chi tiết..."
                        />

                        <div>
                            <label className="block text-sm mb-2 text-[var(--text-secondary)]">Bối cảnh</label>
                            <select value={masterplanContext} onChange={e => setMasterplanContext(e.target.value)} className={selectClass}>
                                <option value="">Chọn bối cảnh...</option>
                                {contextOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Ánh sáng</label>
                                <select value={masterplanLighting} onChange={e => setMasterplanLighting(e.target.value)} className={selectClass}>
                                    <option value="">Chọn ánh sáng...</option>
                                    {lightingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Tone màu</label>
                                <select value={masterplanTone} onChange={e => setMasterplanTone(e.target.value)} className={selectClass}>
                                    <option value="">Chọn tone...</option>
                                    {toneOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Số lượng</label>
                                <div className="flex gap-1 bg-[var(--bg-surface-3)] p-1 rounded-md">
                                    {[1, 2, 4].map(n => (
                                        <button key={n} onClick={() => setNumImages(n)} className={`flex-1 py-1 rounded text-sm font-bold transition-colors ${numImages === n ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-[var(--bg-surface-2)]'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Tỷ lệ</label>
                                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className={selectClass}>
                                    <option value="Auto">Tự động</option>
                                    <option value="16:9">16:9 (Ngang)</option>
                                    <option value="1:1">1:1 (Vuông)</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleGenerate} disabled={isLoading || !sourceImage} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <Icon name="sparkles" className="w-5 h-5"/> {isLoading ? "Đang tạo..." : "Tạo Phối Cảnh Tổng Thể"}
                        </button>
                    </div>
                </Section>

                <Section title="3. Đổi Góc Chụp">
                    <div className="space-y-4">
                        <textarea placeholder="Mô tả góc chụp mới..." className="w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm h-24 border border-[var(--border-2)] text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none" />
                        <select className={selectClass}>
                            <option value="">Hoặc chọn góc chụp có sẵn</option>
                            <option value="drone">Góc nhìn Drone cao</option>
                        </select>
                    </div>
                </Section>
            </div>

            {/* CỘT PHẢI - RESULT & HISTORY */}
            <div className="lg:col-span-2 space-y-8 mb-12">
                <ResultDisplay 
                    sourceImage={sourceImage} 
                    images={generatedImages} 
                    isLoading={isLoading} 
                    selectedImageIndex={selectedImageIndex}
                    onSelectImageIndex={setSelectedImageIndex}
                    onEditRequest={onEditRequest}
                    showChangeAngleButton={false}
                />
                <HistoryPanel 
                    title="Lịch Sử Masterplan 3D" 
                    history={history} 
                    onClear={onClearHistory}
                    onSelect={(item) => {setGeneratedImages(item.images); setSelectedImageIndex(0);}}
                    emptyText="Chưa có lịch sử masterplan."
                />
            </div>
        </div>
    );
};
