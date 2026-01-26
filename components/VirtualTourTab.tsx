
import React, { useState, useCallback } from 'react';
import { Icon } from './icons';
import { generateVirtualTourImage, TourMoveType, applyEffectToTourImage, TourEffectType } from '../services/geminiService';
import type { SourceImage } from '../types';
import { Section, ImageUpload } from './Shared';
import { useToast } from './Toast';

// Reusable components for this tab to keep it self-contained
const ControlButton: React.FC<{ icon: string; label: string; onClick: () => void; disabled: boolean; title: string; }> = ({ icon, label, onClick, disabled, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-1.5 p-3 bg-[var(--bg-surface-2)] rounded-lg hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full h-full aspect-square"
        title={title}
    >
        <Icon name={icon} className="w-8 h-8"/>
        <span className="text-xs font-semibold">{label}</span>
    </button>
);

const FullscreenModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-10"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center">
            <img src={imageUrl} alt="Fullscreen view" className="max-w-full max-h-full object-contain rounded-md" />
        </div>
      </div>
    </div>
  );
};

const EnvironmentToolbar: React.FC<{
    activeEffect: TourEffectType | null;
    onApplyEffect: (effect: TourEffectType) => void;
    disabled: boolean;
}> = ({ activeEffect, onApplyEffect, disabled }) => {
    const effects: { id: TourEffectType, icon: string, label: string }[] = [
        { id: 'night', icon: 'moon', label: 'Ban Đêm' },
        { id: 'day', icon: 'sun', label: 'Ban Ngày' },
        { id: 'magic', icon: 'sparkles', label: 'Kỳ Ảo' },
        { id: 'snow', icon: 'snowflake', label: 'Tuyết Rơi' },
        { id: 'starry', icon: 'sparkles', label: 'Đầy Sao' },
    ];

    return (
        <div className="absolute top-4 right-4 z-20 bg-[var(--bg-surface-2)]/80 backdrop-blur-sm border border-[var(--border-1)] rounded-full p-1.5 flex items-center gap-1.5 shadow-lg">
            {effects.map(effect => (
                <button
                    key={effect.id}
                    onClick={() => onApplyEffect(effect.id)}
                    disabled={disabled}
                    title={effect.label}
                    className={`p-2 rounded-full transition-colors duration-200 ${activeEffect === effect.id ? 'bg-[var(--bg-interactive)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-3)]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Icon name={effect.icon} className="w-5 h-5" />
                </button>
            ))}
        </div>
    );
};

type AppTab = 'exterior' | 'interior' | 'floorplan' | 'virtual_tour' | 'edit' | 'utilities';

interface VirtualTourTabProps {
  setActiveTab: (tab: AppTab) => void;
  setImageForEditing: (image: SourceImage | null) => void;
  onCreateVideoRequest: (imageUrl: string) => void;
  onImageGenerated: () => void;
}

export const VirtualTourTab: React.FC<VirtualTourTabProps> = ({ setActiveTab, setImageForEditing, onCreateVideoRequest, onImageGenerated }) => {
    const [currentImage, setCurrentImage] = useState<SourceImage | null>(null);
    const [undoStack, setUndoStack] = useState<SourceImage[]>([]);
    const [redoStack, setRedoStack] = useState<SourceImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [magnitude, setMagnitude] = useState<15 | 30 | 45>(30);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeEffect, setActiveEffect] = useState<TourEffectType | null>(null);
    const { addToast } = useToast();

    const handleImageUpload = (image: SourceImage) => {
        setCurrentImage(image);
        setUndoStack([]);
        setRedoStack([]);
        setActiveEffect(null);
    };

    const handleRemoveImage = () => {
        setCurrentImage(null);
        setUndoStack([]);
        setRedoStack([]);
        setActiveEffect(null);
    };

    const handleNavigate = useCallback(async (moveType: TourMoveType) => {
        if (!currentImage) {
            addToast({type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh để bắt đầu chuyến tham quan.'});
            return;
        }

        setIsLoading(true);
        const messages: Record<TourMoveType, string> = {
            'pan-up': 'Đang nghiêng camera lên...',
            'pan-down': 'Đang nghiêng camera xuống...',
            'pan-left': 'Đang xoay camera sang trái...',
            'pan-right': 'Đang xoay camera sang phải...',
            'orbit-left': 'Đang di chuyển quanh đối tượng...',
            'orbit-right': 'Đang di chuyển quanh đối tượng...',
            'zoom-in': 'Đang phóng to...',
            'zoom-out': 'Đang thu nhỏ...'
        };
        setLoadingMessage(messages[moveType]);

        try {
            const newImageSrc = await generateVirtualTourImage(currentImage, moveType, magnitude);
            if (newImageSrc) {
                const newImage: SourceImage = {
                    base64: newImageSrc.split(',')[1],
                    mimeType: newImageSrc.match(/data:(image\/[a-z]+);/)?.[1] || 'image/png'
                };
                setUndoStack(prev => [...prev, currentImage]);
                setCurrentImage(newImage);
                setRedoStack([]); // New action clears the redo stack
                setActiveEffect(null);
                onImageGenerated();
            } else {
                throw new Error("AI không thể tạo ảnh cho hướng di chuyển này.");
            }
        } catch (error) {
            console.error("Virtual tour navigation failed:", error);
            const message = `Đã xảy ra lỗi: ${error instanceof Error ? error.message : "Unknown error"}`;
            addToast({type: 'error', title: 'Lỗi Điều Hướng', message});
        } finally {
            setIsLoading(false);
        }
    }, [currentImage, magnitude, addToast, onImageGenerated]);
    
    const handleApplyEffect = async (effect: TourEffectType) => {
        if (!currentImage) {
            addToast({type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải lên ảnh để bắt đầu.'});
            return;
        }
        if (isLoading) return;

        setActiveEffect(effect);
        setIsLoading(true);
        setLoadingMessage(`Đang áp dụng hiệu ứng: ${effect}...`);

        try {
            const newImageSrc = await applyEffectToTourImage(currentImage, effect);
            if (newImageSrc) {
                const newImage: SourceImage = {
                    base64: newImageSrc.split(',')[1],
                    mimeType: newImageSrc.match(/data:(image\/[a-z]+);/)?.[1] || 'image/png'
                };
                setUndoStack(prev => [...prev, currentImage]);
                setCurrentImage(newImage);
                setRedoStack([]);
                onImageGenerated();
            } else {
                throw new Error("AI không thể tạo ảnh cho hiệu ứng này.");
            }
        } catch (error) {
            console.error("Applying effect failed:", error);
            const message = `Đã xảy ra lỗi: ${error instanceof Error ? error.message : "Unknown error"}`;
            addToast({type: 'error', title: 'Lỗi Hiệu Ứng', message});
            setActiveEffect(null); // Deselect on failure
        } finally {
            setIsLoading(false);
        }
    };

    const handleUndo = () => {
        if (undoStack.length > 0) {
            const newUndoStack = [...undoStack];
            const previousImage = newUndoStack.pop();
            setRedoStack(prev => [currentImage!, ...prev]);
            setCurrentImage(previousImage!);
            setUndoStack(newUndoStack);
            setActiveEffect(null);
        }
    };

    const handleRedo = () => {
        if (redoStack.length > 0) {
            const newRedoStack = [...redoStack];
            const nextImage = newRedoStack.shift();
            setUndoStack(prev => [...prev, currentImage!]);
            setCurrentImage(nextImage!);
            setRedoStack(newRedoStack);
            setActiveEffect(null);
        }
    };
    
    const handleEdit = () => {
        if (currentImage) {
            setImageForEditing(currentImage);
            setActiveTab('edit');
        }
    };

    const handleCreateVideo = () => {
        if (currentImage) {
            const imageUrl = `data:${currentImage.mimeType};base64,${currentImage.base64}`;
            onCreateVideoRequest(imageUrl);
        }
    };

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1 flex flex-col gap-8">
                <Section title="1. Điểm Bắt Đầu">
                    <ImageUpload
                        sourceImage={currentImage}
                        onImageUpload={handleImageUpload}
                        onRemove={handleRemoveImage}
                    />
                </Section>
                {currentImage && (
                    <Section title="2. Bảng Điều Khiển Camera">
                        <div className="space-y-6">
                             <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Mức độ di chuyển</label>
                                <div className="flex items-center gap-2 bg-[var(--bg-surface-3)] rounded-md p-1">
                                    {(['15', '30', '45'] as const).map(angle => (
                                        <button 
                                            key={angle}
                                            onClick={() => setMagnitude(Number(angle) as 15 | 30 | 45)}
                                            className={`w-full text-sm font-semibold py-1.5 rounded-md transition-colors ${magnitude === Number(angle) ? 'bg-[var(--bg-interactive)] text-[var(--text-interactive)] shadow' : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
                                        >
                                            {angle}°
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-[var(--text-tertiary)] mt-1">Áp dụng cho Pan và Orbit. Zoom có mức độ cố định.</p>
                            </div>

                             {/* Pan Controls */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-center text-[var(--text-secondary)]">Pan (Xoay camera tại chỗ)</h3>
                                <div className="grid grid-cols-3 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                    <div />
                                    <ControlButton icon="arrow-up-circle" label="Lên" onClick={() => handleNavigate('pan-up')} disabled={isLoading} title="Nghiêng lên" />
                                    <div />
                                    <ControlButton icon="arrow-left-circle" label="Trái" onClick={() => handleNavigate('pan-left')} disabled={isLoading} title="Xoay trái" />
                                    <div className="flex items-center justify-center">
                                      <Icon name="cursor-arrow-rays" className="w-8 h-8 text-[var(--text-tertiary)]" />
                                    </div>
                                    <ControlButton icon="arrow-right-circle" label="Phải" onClick={() => handleNavigate('pan-right')} disabled={isLoading} title="Xoay phải" />
                                    <div />
                                    <ControlButton icon="arrow-down-circle" label="Xuống" onClick={() => handleNavigate('pan-down')} disabled={isLoading} title="Nghiêng xuống" />
                                    <div />
                                </div>
                            </div>
                            
                            {/* Orbit & Zoom Controls */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-center text-[var(--text-secondary)]">Orbit (Quỹ đạo)</h3>
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                        <ControlButton icon="arrow-uturn-left" label="Quay Trái" onClick={() => handleNavigate('orbit-left')} disabled={isLoading} title="Đi vòng sang trái" />
                                        <ControlButton icon="arrow-uturn-right" label="Quay Phải" onClick={() => handleNavigate('orbit-right')} disabled={isLoading} title="Đi vòng sang phải" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-center text-[var(--text-secondary)]">Zoom</h3>
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg-surface-4)]/50 rounded-lg">
                                        <ControlButton icon="magnifying-glass-plus" label="Gần Lại" onClick={() => handleNavigate('zoom-in')} disabled={isLoading} title="Phóng to" />
                                        <ControlButton icon="magnifying-glass-minus" label="Ra Xa" onClick={() => handleNavigate('zoom-out')} disabled={isLoading} title="Thu nhỏ" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleUndo}
                                    disabled={isLoading || undoStack.length === 0}
                                    className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold py-2 px-2 rounded transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon name="arrow-uturn-left" className="w-4 h-4"/> Hoàn Tác
                                </button>
                                <button
                                    onClick={handleRedo}
                                    disabled={isLoading || redoStack.length === 0}
                                    className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold py-2 px-2 rounded transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon name="arrow-uturn-right" className="w-4 h-4"/> Làm Lại
                                </button>
                            </div>
                        </div>
                    </Section>
                )}
            </div>

            {/* Right Column - Viewer */}
            <div className="lg:col-span-2">
                <Section title="Khung Cảnh Hiện Tại">
                    <div className="w-full aspect-video bg-black/20 rounded-lg flex items-center justify-center relative group">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">{loadingMessage}</p>
                            </div>
                        ) : currentImage ? (
                            <>
                                <img
                                    src={`data:${currentImage.mimeType};base64,${currentImage.base64}`}
                                    alt="Current virtual tour view"
                                    className="max-w-full max-h-full object-contain rounded-md"
                                />
                                <EnvironmentToolbar activeEffect={activeEffect} onApplyEffect={handleApplyEffect} disabled={isLoading} />
                                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Xem Toàn Màn Hình"
                                    >
                                        <Icon name="arrows-expand" className="w-4 h-4" />
                                        <span>Phóng To</span>
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Sửa ảnh này"
                                    >
                                        <Icon name="pencil" className="w-4 h-4" />
                                        <span>Sửa</span>
                                    </button>
                                    <button
                                        onClick={handleCreateVideo}
                                        className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                                        title="Tạo video từ ảnh này"
                                    >
                                        <Icon name="film" className="w-4 h-4" />
                                        <span>Tạo Video</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-[var(--text-tertiary)]">
                                <Icon name="cursor-arrow-rays" className="w-16 h-16 mx-auto mb-4" />
                                <p>Tải lên một ảnh để bắt đầu tour.</p>
                            </div>
                        )}
                    </div>
                </Section>
            </div>
        </div>
        {isModalOpen && currentImage && (
            <FullscreenModal imageUrl={`data:${currentImage.mimeType};base64,${currentImage.base64}`} onClose={() => setIsModalOpen(false)} />
        )}
      </>
    );
};

export default VirtualTourTab; // Added default export