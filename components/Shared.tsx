import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './icons';
import type { SourceImage } from '../types';
import { useLanguage } from './LanguageContext';

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
    {children}
  </div>
);

// Define selectCommonStyles here for reuse
export const selectCommonStyles = "w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none appearance-none";


export const ImageUpload: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ sourceImage, onImageUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { t } = useLanguage();

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        if (base64) {
          onImageUpload({ base64, mimeType: file.type });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the file dialog from opening
    onRemove();
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-48 mb-4 hover:border-[var(--border-interactive)] transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {sourceImage ? (
          <>
            <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source" className="max-h-full max-w-full object-contain rounded" />
            <button
              onClick={handleRemove}
              className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
              aria-label="Remove source image"
            >
              <Icon name="x-circle" className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-center text-[var(--text-secondary)] pointer-events-none">
            <p>{t('drag_drop')}</p>
            <p className="text-xs">{t('drag_drop_sub')}</p>
          </div>
        )}
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-2 px-4 rounded transition-colors"
      >
        {sourceImage ? t('btn_change_image') : t('btn_upload')}
      </button>
    </div>
  );
};

export const ReferenceImageUpload: React.FC<{
  image: SourceImage | null;
  onUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ image, onUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        if (base64) {
          onUpload({ base64, mimeType: file.type });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (image) {
    return (
      <div className="relative group">
        <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Reference" className="w-full h-56 object-cover rounded-md" />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
          aria-label="Remove reference image"
        >
          <Icon name="x-circle" className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-56 text-center text-[var(--text-secondary)] text-sm hover:border-[var(--border-interactive)] transition-colors ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
      >
        + Thêm ảnh tham khảo (Tone/Mood)
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
    </>
  );
};

export const ImageCompareSlider: React.FC<{ beforeImage: string | null; afterImage: string; }> = ({ beforeImage, afterImage }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (!beforeImage) {
    return <img src={afterImage} alt="Result" className="max-w-full max-h-full object-contain rounded-md" />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden rounded-md cursor-ew-resize group/slider"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img
        src={beforeImage}
        alt="Before"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <div
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={afterImage}
          alt="After"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-1 bg-white/50 pointer-events-none z-10"
        style={{ left: `calc(${sliderPosition}% - 0.5px)` }}
      ></div>
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-[var(--bg-surface-4)]/80 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center text-white pointer-events-none shadow-lg transition-transform group-hover/slider:scale-110 z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        <Icon name="arrows-right-left" className="w-5 h-5" />
      </div>

      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none z-10">
        Gốc
      </div>
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none z-10"
        style={{ opacity: sliderPosition > 60 ? 1 : 0, transition: 'opacity 0.2s' }}
      >
        Kết Quả
      </div>
    </div>
  );
};

export const ImageViewerModal: React.FC<{ images: string[]; startIndex: number; onClose: () => void; }> = ({ images, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const imageUrl = images[currentIndex];

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : prev));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-20"
          aria-label="Đóng"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center relative">
          <img src={imageUrl} alt={`Fullscreen view ${currentIndex + 1}`} className="max-w-full max-h-full object-contain rounded-md" />

          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Trước"
              >
                <Icon name="chevron-left" className="w-8 h-8" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Sau"
              >
                <Icon name="chevron-right" className="w-8 h-8" />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="text-center text-sm text-white/80 pb-2 font-mono">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
};

export const UserGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useLanguage();
  const [activeGuideTab, setActiveGuideTab] = useState<'general' | 'exterior' | 'interior' | 'floorplan' | 'tour' | 'edit' | 'utils'>('general');

  const TabButton = ({ id, label }: { id: typeof activeGuideTab, label: string }) => (
    <button
      onClick={() => setActiveGuideTab(id)}
      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeGuideTab === id ? 'bg-[var(--bg-interactive)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-3)] hover:text-[var(--text-primary)]'}`}
    >
      {label}
    </button>
  );

  const Step = ({ num, text }: { num: number, text: string }) => (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--bg-interactive)] text-white flex items-center justify-center text-xs font-bold mt-0.5">
        {num}
      </div>
      <p className="text-[var(--text-primary)] text-sm leading-relaxed">{text}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/95 border border-[var(--border-1)] rounded-xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col md:flex-row overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <Icon name="x-mark" className="w-6 h-6" />
        </button>

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-[var(--bg-surface-2)] p-4 flex flex-col gap-1 overflow-y-auto border-r border-[var(--border-1)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)] px-4 mb-4 flex items-center gap-2">
            <Icon name="question-mark-circle" className="w-5 h-5" />
            {t('guide_title')}
          </h2>
          <TabButton id="general" label={t('guide_tab_general')} />
          <TabButton id="exterior" label={t('guide_tab_exterior')} />
          <TabButton id="interior" label={t('guide_tab_interior')} />
          <TabButton id="floorplan" label={t('guide_tab_floorplan')} />
          <TabButton id="tour" label={t('guide_tab_tour')} />
          <TabButton id="edit" label={t('guide_tab_edit')} />
          <TabButton id="utils" label={t('guide_tab_utils')} />
        </div>

        {/* Content */}
        <div className="flex-grow p-8 overflow-y-auto">
          {activeGuideTab === 'general' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_gen_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_gen_desc')}</p>
              <Step num={1} text={t('guide_gen_step1')} />
              <Step num={2} text={t('guide_gen_step2')} />
              <Step num={3} text={t('guide_gen_step3')} />
              <Step num={4} text={t('guide_gen_step4')} />
            </div>
          )}
          {activeGuideTab === 'exterior' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_ext_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_ext_desc')}</p>
              <Step num={1} text={t('guide_ext_step1')} />
              <Step num={2} text={t('guide_ext_step2')} />
              <Step num={3} text={t('guide_ext_step3')} />
              <Step num={4} text={t('guide_ext_step4')} />
            </div>
          )}
          {activeGuideTab === 'interior' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_int_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_int_desc')}</p>
              <Step num={1} text={t('guide_int_step1')} />
              <Step num={2} text={t('guide_int_step2')} />
              <Step num={3} text={t('guide_int_step3')} />
            </div>
          )}
          {activeGuideTab === 'floorplan' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_fp_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_fp_desc')}</p>
              <Step num={1} text={t('guide_fp_step1')} />
              <Step num={2} text={t('guide_fp_step2')} />
              <Step num={3} text={t('guide_fp_step3')} />
            </div>
          )}
          {activeGuideTab === 'tour' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_tour_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_tour_desc')}</p>
              <Step num={1} text={t('guide_tour_step1')} />
              <Step num={2} text={t('guide_tour_step2')} />
              <Step num={3} text={t('guide_tour_step3')} />
            </div>
          )}
          {activeGuideTab === 'edit' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_edit_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_edit_desc')}</p>
              <Step num={1} text={t('guide_edit_step1')} />
              <Step num={2} text={t('guide_edit_step2')} />
              <Step num={3} text={t('guide_edit_step3')} />
            </div>
          )}
          {activeGuideTab === 'utils' && (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{t('guide_utils_title')}</h3>
              <p className="text-[var(--text-secondary)] mb-6">{t('guide_utils_desc')}</p>
              <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg mb-4">
                <h4 className="font-bold text-[var(--text-accent)] mb-1">Mood Board</h4>
                <p className="text-sm text-[var(--text-secondary)]">{t('guide_utils_mood')}</p>
              </div>
              <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg">
                <h4 className="font-bold text-[var(--text-accent)] mb-1">Finish My Build</h4>
                <p className="text-sm text-[var(--text-secondary)]">{t('guide_utils_finish')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ApiKeyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  initialKey?: string;
}> = ({ isOpen, onClose, onSave, initialKey = '' }) => {
  const { t } = useLanguage();
  const [key, setKey] = useState(initialKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/95 border border-[var(--border-1)] rounded-xl shadow-2xl max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Icon name="key" className="w-5 h-5" />
          {t('api_key_title')}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{t('api_key_desc')}</p>
        <div className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('api_key_placeholder')}
            className="w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm border border-[var(--border-2)] focus:ring-2 focus:ring-[var(--ring-focus)] outline-none"
          />
          <button
            onClick={() => onSave(key)}
            className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {t('api_key_save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Visual Angle Selector (Updated with Dropdown) ---

interface VisualAngleSelectorProps {
  onSelectAngle: (prompt: string) => void;
  selectedAnglePrompt?: string;
  mode: 'exterior' | 'interior';
}

export const VisualAngleSelector: React.FC<VisualAngleSelectorProps> = ({ onSelectAngle, selectedAnglePrompt, mode }) => {
  const [hoveredAngle, setHoveredAngle] = useState<string | null>(null);
  const { t } = useLanguage();

  // Mapping configuration for angles
  const exteriorAngles = [
    { id: 'top-left', icon: 'arrow-up-circle', rotate: '-45deg', label: '3/4 Trên Trái', prompt: 'Góc 3/4 từ trên cao bên trái (High angle 3/4 left view)' },
    { id: 'top', icon: 'arrow-up-circle', rotate: '0deg', label: 'Trên Cao (Drone)', prompt: 'Góc chụp từ trên cao nhìn xuống (Drone view/Bird\'s eye view)' },
    { id: 'top-right', icon: 'arrow-up-circle', rotate: '45deg', label: '3/4 Trên Phải', prompt: 'Góc 3/4 từ trên cao bên phải (High angle 3/4 right view)' },
    { id: 'left', icon: 'arrow-left-circle', rotate: '0deg', label: 'Bên Trái', prompt: 'Góc chụp từ bên trái sang (Left side view)' },
    { id: 'center', icon: 'viewfinder', rotate: '0deg', label: 'Trực Diện', prompt: 'Góc chụp trực diện chính giữa (Front view eye-level)' },
    { id: 'right', icon: 'arrow-right-circle', rotate: '0deg', label: 'Bên Phải', prompt: 'Góc chụp từ bên phải sang (Right side view)' },
    { id: 'bottom-left', icon: 'arrow-down-circle', rotate: '45deg', label: '3/4 Dưới Trái', prompt: 'Góc 3/4 từ dưới lên bên trái (Low angle 3/4 left view)' },
    { id: 'bottom', icon: 'arrow-down-circle', rotate: '0deg', label: 'Dưới Lên (Low)', prompt: 'Góc chụp từ dưới lên (Worm\'s eye view/Low angle)' },
    { id: 'bottom-right', icon: 'arrow-down-circle', rotate: '-45deg', label: '3/4 Dưới Phải', prompt: 'Góc 3/4 từ dưới lên bên phải (Low angle 3/4 right view)' },
  ];

  const interiorAngles = [
    { id: 'top-left', icon: 'arrow-up-circle', rotate: '-45deg', label: 'Góc Cao Trái', prompt: 'Góc nhìn từ trần nhà xuống góc trái (High angle left corner)' },
    { id: 'top', icon: 'arrow-up-circle', rotate: '0deg', label: 'Trần Nhà (Plan)', prompt: 'Góc nhìn từ trần nhà thẳng xuống (Top-down/Floorplan view)' },
    { id: 'top-right', icon: 'arrow-up-circle', rotate: '45deg', label: 'Góc Cao Phải', prompt: 'Góc nhìn từ trần nhà xuống góc phải (High angle right corner)' },
    { id: 'left', icon: 'arrow-left-circle', rotate: '0deg', label: 'Tường Trái', prompt: 'Góc nhìn thẳng vào tường bên trái (Left wall elevation)' },
    { id: 'center', icon: 'viewfinder', rotate: '0deg', label: 'Trực Diện', prompt: 'Góc nhìn chính diện căn phòng (Straight-on view)' },
    { id: 'right', icon: 'arrow-right-circle', rotate: '0deg', label: 'Tường Phải', prompt: 'Góc nhìn thẳng vào tường bên phải (Right wall elevation)' },
    { id: 'bottom-left', icon: 'arrow-down-circle', rotate: '45deg', label: 'Góc Thấp Trái', prompt: 'Góc nhìn thấp từ sàn nhà bên trái (Low angle left)' },
    { id: 'bottom', icon: 'arrow-down-circle', rotate: '0deg', label: 'Sàn Nhà', prompt: 'Góc nhìn sát sàn nhà (Floor level view)' },
    { id: 'bottom-right', icon: 'arrow-down-circle', rotate: '-45deg', label: 'Góc Thấp Phải', prompt: 'Góc nhìn thấp từ sàn nhà bên phải (Low angle right)' },
  ];

  const angles = mode === 'interior' ? interiorAngles : exteriorAngles;

  // Dropdown options based on user request (mapped to prompts)
  const getDropdownOptions = () => {
    const isExt = mode === 'exterior';
    return [
      {
        label: t('angle_top_down'),
        prompt: isExt
          ? 'Góc chụp từ trên cao nhìn xuống (High angle / Drone view), bao quát toàn bộ công trình.'
          : 'Góc nhìn từ trần nhà thẳng xuống (Top-down / Floorplan view).'
      },
      {
        label: t('angle_low'),
        prompt: isExt
          ? 'Góc chụp từ dưới lên (Low angle / Worm\'s eye view), tạo cảm giác công trình hùng vĩ, tráng lệ.'
          : 'Góc chụp thấp từ sàn nhà lên (Low angle), tạo cảm giác trần nhà cao và không gian rộng hơn.'
      },
      {
        label: t('angle_34_left'),
        prompt: isExt
          ? 'Góc nhìn 3/4 từ bên trái (3/4 Left view), thể hiện rõ khối và chiều sâu.'
          : 'Góc nhìn chéo 3/4 từ phía bên trái căn phòng.'
      },
      {
        label: t('angle_wide'),
        prompt: isExt
          ? 'Góc chụp toàn cảnh từ xa (Wide angle / Long shot), thấy công trình trong bối cảnh rộng.'
          : 'Góc chụp góc rộng toàn cảnh căn phòng (Wide angle interior shot).'
      },
      {
        label: t('angle_close'),
        prompt: 'Góc chụp cận cảnh chi tiết (Close-up detail), tập trung vào vật liệu và chi tiết kiến trúc.'
      },
      {
        label: t('angle_34_right'),
        prompt: isExt
          ? 'Góc nhìn 3/4 từ bên phải (3/4 Right view), thể hiện rõ khối và chiều sâu.'
          : 'Góc nhìn chéo 3/4 từ phía bên phải căn phòng.'
      },
      {
        label: t('angle_front'),
        prompt: isExt
          ? 'Góc chụp chính diện (Front view), cân đối và đối xứng hoàn hảo.'
          : 'Góc nhìn chính diện vào bức tường chính (Front elevation view).'
      },
    ];
  };

  const dropdownOptions = getDropdownOptions();

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
      {/* Dropdown Selection */}
      <div className="w-full mb-6">
        <select
          className="w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none appearance-none cursor-pointer border border-[var(--border-2)] hover:border-[var(--border-interactive)] transition-colors"
          onChange={(e) => {
            if (e.target.value) onSelectAngle(e.target.value);
            e.target.value = ""; // Reset to placeholder
          }}
          defaultValue=""
          style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
        >
          <option value="" disabled>{t('angle_placeholder')}</option>
          {dropdownOptions.map((opt, idx) => (
            <option key={idx} value={opt.prompt}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Visual Controller */}
      <div className="relative p-2 bg-[var(--bg-surface-2)] rounded-[2rem] shadow-xl border-4 border-[var(--bg-surface-4)] backdrop-blur-sm">
        <div className="absolute inset-0 bg-[var(--bg-surface-3)] rounded-[1.7rem] opacity-10 pointer-events-none"></div>
        <div className="grid grid-cols-3 gap-2 relative z-10">
          {angles.map((angle) => {
            const isSelected = selectedAnglePrompt === angle.prompt;
            const isCenter = angle.id === 'center';

            return (
              <button
                key={angle.id}
                onClick={() => onSelectAngle(angle.prompt)}
                onMouseEnter={() => setHoveredAngle(angle.label)}
                onMouseLeave={() => setHoveredAngle(null)}
                className={`
                                    flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-200 shadow-md active:scale-95
                                    ${isCenter
                    ? 'bg-[var(--bg-surface-4)] border-2 border-[var(--border-accent)] z-20'
                    : 'bg-[var(--bg-surface-1)] border border-[var(--border-1)] hover:border-[var(--border-interactive)]'
                  }
                                    ${isSelected
                    ? 'bg-[var(--bg-interactive)] text-white border-[var(--border-interactive)] transform scale-105 ring-2 ring-[var(--ring-focus)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-3)] hover:text-[var(--text-primary)] hover:scale-105'
                  }
                                `}
                title={angle.label}
              >
                <div style={{ transform: `rotate(${angle.rotate})` }} className="transition-transform duration-300">
                  <Icon name={angle.icon} className={isCenter ? "w-8 h-8" : "w-6 h-6"} />
                </div>
                {isSelected && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Decor lines */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[var(--border-1)] -z-0 pointer-events-none opacity-30"></div>
        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[var(--border-1)] -z-0 pointer-events-none opacity-30"></div>
      </div>
      <div className="mt-4 h-8 flex items-center justify-center">
        <div className={`px-4 py-1 bg-[var(--bg-surface-3)] rounded-full border border-[var(--border-2)] transition-all duration-300 ${hoveredAngle ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-1'}`}>
          <p className="text-sm font-bold text-[var(--text-accent)] text-center whitespace-nowrap">
            {hoveredAngle || (selectedAnglePrompt ? t('angle_selected') : t('angle_select'))}
          </p>
        </div>
      </div>
    </div>
  );
};

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  return (
    <footer className="w-full bg-black/50 backdrop-blur-xl border-t border-white/10 text-slate-300 py-10 px-6 mt-12 z-40 relative">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-sm">

        {/* Column 1: International Info & Socials */}
        <div className="flex flex-col gap-4">
          <h3 className="text-white font-bold uppercase tracking-wider mb-2">CPG INTERNATIONAL PTE LTD</h3>
          <p className="flex items-start gap-2">
            <Icon name="home" className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
            <span>1 Gateway Drive #25-01 Westgate Tower Singapore 608531</span>
          </p>

          <div className="mt-6">
            <h4 className="text-white font-bold uppercase tracking-wider mb-3">{t('footer_quick_links')}</h4>
            <div className="flex gap-4">
              <a href="https://cpgvietnam.com.vn/" target="_blank" rel="noopener noreferrer" className="bg-white/10 p-2 rounded-full hover:bg-blue-600 hover:text-white transition-all">
                <Icon name="facebook" className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/company/cpg-vietnam-company-limited/" target="_blank" rel="noopener noreferrer" className="bg-white/10 p-2 rounded-full hover:bg-blue-700 hover:text-white transition-all">
                <Icon name="linkedin" className="w-5 h-5" />
              </a>
            </div>
            <a href="https://www.cpgcorp.com.sg/" target="_blank" rel="noreferrer" className="block mt-4 text-slate-400 hover:text-white transition-colors">CPG Corporation Pte Ltd</a>
          </div>
        </div>

        {/* Column 2: HCM Office */}
        <div className="flex flex-col gap-4">
          <h3 className="text-white font-bold uppercase tracking-wider mb-2 border-b border-white/20 pb-2 inline-block">CPG VIETNAM CO., LTD</h3>

          <div>
            <h4 className="text-slate-100 font-semibold mb-1">{t('footer_hcm')}</h4>
            <p className="flex items-start gap-2 mb-2">
              <Icon name="home" className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
              <span>Level 11, Lottery Tower<br />77 Tran Nhan Ton Street, An Dong Ward,<br />Ho Chi Minh City, Vietnam</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="opacity-70">📞</span> +84 (0) 28 3821 7000
            </p>
            <p className="flex items-center gap-2">
              <span className="opacity-70">✉️</span> cpgvietnam@cpgcorp.com.sg
            </p>
          </div>
        </div>

        {/* Column 3: Hanoi Office */}
        <div className="flex flex-col gap-4">
          <div className="md:mt-10"> {/* Spacer to align with HCM block title */}
            <h4 className="text-slate-100 font-semibold mb-1">{t('footer_hn')}</h4>
            <p className="flex items-start gap-2 mb-2">
              <Icon name="home" className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
              <span>Unit 303A, Coalimex Building<br />33 Trang Thi Street, Cua Nam Ward,<br />Hanoi, Vietnam</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="opacity-70">📞</span> +84 (0) 24 3938 7073
            </p>
            <p className="flex items-center gap-2">
              <span className="opacity-70">✉️</span> cpgvietnam@cpgcorp.com.sg
            </p>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/10 text-center text-xs text-slate-500">
        <p>{t('footer_rights')}</p>
      </div>
    </footer>
  );
};

export const CreativitySlider: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => {
  const labels = [
    "20% - Giữ nguyên gốc",
    "40% - Thay đổi nhỏ",
    "60% - Sáng tạo vừa",
    "80% - Sáng tạo cao",
    "100% - Biến đổi hoàn toàn"
  ];

  return (
    <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg border border-[var(--border-2)]">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Mức độ sáng tạo AI</label>
        <span className="text-xs font-bold text-[var(--text-accent)]">{labels[value - 1]}</span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[var(--bg-surface-3)] rounded-lg appearance-none cursor-pointer accent-[var(--bg-interactive)]"
      />
      <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)] font-mono">
        <span>1 (Strict)</span>
        <span>5 (Freedom)</span>
      </div>
    </div>
  );
};

export const ToggleSwitch: React.FC<{
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ label, enabled, onChange }) => (
  <div className="flex items-center justify-between bg-[var(--bg-surface-2)] p-3 rounded-lg">
    <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface-1)] ${enabled ? 'bg-[var(--bg-interactive)]' : 'bg-[var(--bg-surface-3)]'
        }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </button>
  </div>
);

export const ResultDisplay: React.FC<{
  sourceImage: SourceImage | null;
  images: string[];
  isLoading: boolean;
  onUpscale?: (index: number, target: '2k' | '4k') => void;
  upscalingIndex?: number | null;
  onEditRequest: (image: string) => void;
  selectedImageIndex: number;
  onSelectImageIndex: (index: number) => void;
  onChangeAngle?: (index: number) => void;
  onFullscreen?: (index: number) => void;
  onCreateVideoRequest?: (image: string) => void;
  showChangeAngleButton: boolean;
}> = React.memo(({ sourceImage, images, isLoading, onUpscale, upscalingIndex, onEditRequest, selectedImageIndex, onSelectImageIndex, onChangeAngle, onFullscreen, onCreateVideoRequest, showChangeAngleButton }) => {
  const selectedImage = images[selectedImageIndex];
  const sourceImageUrl = sourceImage ? `data:${sourceImage.mimeType};base64,${sourceImage.base64}` : null;
  const { t } = useLanguage();

  const handleSelectIndex = useCallback((index: number) => {
    onSelectImageIndex(index);
  }, [onSelectImageIndex]);

  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl h-full flex flex-col">
      <div className="relative z-10 flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('res_title')}</h2>
        {images.length > 0 && <span className="text-sm text-[var(--text-secondary)]">{images.length} ảnh</span>}
      </div>

      {/* Main Preview */}
      <div className="relative z-10 flex-grow flex items-center justify-center bg-black/20 rounded-lg mb-4 min-h-[300px] md:min-h-[400px]">
        {isLoading ? (
          <div className="w-full h-full bg-[var(--bg-surface-2)] rounded-lg animate-pulse"></div>
        ) : selectedImage ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            <ImageCompareSlider beforeImage={sourceImageUrl} afterImage={selectedImage} />

            {upscalingIndex === selectedImageIndex && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg z-20">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                <p className="mt-3 font-semibold text-sm text-slate-200">Upscaling...</p>
              </div>
            )}

            {/* Navigation Buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => handleSelectIndex(selectedImageIndex - 1)}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                  aria-label="Previous"
                >
                  <Icon name="chevron-left" className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleSelectIndex(selectedImageIndex + 1)}
                  disabled={selectedImageIndex === images.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                  aria-label="Next"
                >
                  <Icon name="chevron-right" className="w-6 h-6" />
                </button>
              </>
            )}

            {!upscalingIndex && (
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                {onFullscreen && (
                  <button
                    onClick={() => onFullscreen(selectedImageIndex)}
                    className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                    title={t('res_zoom')}
                  >
                    <Icon name="arrows-expand" className="w-4 h-4" />
                    <span>{t('res_zoom')}</span>
                  </button>
                )}
                <button
                  onClick={() => onEditRequest(selectedImage)}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                  title={t('res_edit')}
                >
                  <Icon name="pencil" className="w-4 h-4" />
                  <span>{t('res_edit')}</span>
                </button>
                {onCreateVideoRequest && (
                  <button
                    onClick={() => onCreateVideoRequest(selectedImage)}
                    className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                    title={t('res_video')}
                  >
                    <Icon name="film" className="w-4 h-4" />
                    <span>{t('res_video')}</span>
                  </button>
                )}
                {showChangeAngleButton && onChangeAngle && (
                  <button
                    onClick={() => onChangeAngle(selectedImageIndex)}
                    className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                    title={t('res_angle')}
                  >
                    <Icon name="viewfinder" className="w-4 h-4" />
                    <span>{t('res_angle')}</span>
                  </button>
                )}
                <a
                  href={selectedImage}
                  download={`CPGVN_${Date.now()}.png`}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                  aria-label="Download"
                  title={t('btn_download')}
                >
                  <Icon name="download" className="w-4 h-4" />
                  <span>{t('btn_download')}</span>
                </a>
              </div>
            )}

            {!upscalingIndex && onUpscale && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button
                  onClick={() => onUpscale(selectedImageIndex, '2k')}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold text-xs px-2 py-1 rounded-md transition-colors"
                  title={t('res_upscale_2k')}
                >
                  {t('res_upscale_2k')}
                </button>
                <button
                  onClick={() => onUpscale(selectedImageIndex, '4k')}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold text-xs px-2 py-1 rounded-md transition-colors"
                  title={t('res_upscale_4k')}
                >
                  {t('res_upscale_4k')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[var(--text-tertiary)]">
            <p>{t('res_empty')}</p>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className={`relative z-10 grid gap-3 ${images.length > 1 ? 'grid-cols-4' : 'grid-cols-1'}`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square bg-[var(--bg-surface-2)] rounded-lg animate-pulse"></div>
          ))
        ) : (
          images.map((image, index) => (
            <div
              key={index}
              className={`relative group aspect-square bg-[var(--bg-surface-2)] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-surface-1)] ring-[var(--ring-active)]' : 'opacity-70 hover:opacity-100'}`}
              onClick={() => handleSelectIndex(index)}
            >
              <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))
        )}
      </div>
    </div>
  );
});