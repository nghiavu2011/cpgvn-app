
import React, { useState, useCallback, useEffect, Suspense } from 'react';
import type { RenderHistoryItem, SourceImage, EditHistoryItem, GeneratedPrompts, RenderTabState } from './types';
import { generateImages, upscaleImage, convertToSketchyStyle, analyzeLayout3DPrompt, convertToStyle, updateGeminiApiKey } from './services/geminiService';
import { Icon } from './components/icons';
import { ToastProvider, useToast } from './components/Toast';
import { Section, ImageUpload, ReferenceImageUpload, ResultDisplay, ImageViewerModal, VisualAngleSelector, Footer, UserGuideModal, ApiKeyModal, selectCommonStyles, CreativitySlider, ImageCompareSlider } from './components/Shared';
import { useLanguage, Language } from './components/LanguageContext';
import { HistoryPanel } from './components/HistoryPanel';
import { EditHistoryPanel } from './components/EditHistoryPanel';
import { MasterplanTo3D } from './components/MasterplanTo3D';

// Lazy Load Heavy Components
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const UtilitiesTab = React.lazy(() => import('./components/UtilitiesTab').then(module => ({ default: module.UtilitiesTab })));
const VirtualTourTab = React.lazy(() => import('./components/VirtualTourTab'));

type RenderTab = 'exterior' | 'interior' | 'masterplan' | 'floorplan';
type AppTab = RenderTab | 'virtual_tour' | 'edit' | 'utilities';
type Theme = 'dark' | 'light' | 'orange' | 'christmas' | 'tet' | 'beach' | 'architecture';

const initialTabState: RenderTabState = {
  sourceImage: null,
  sketchyImage: null,
  referenceImage: null,
  generatedImages: [],
  selectedImageIndex: 0,
  useSketchyStyle: true,
  creativityLevel: 3, // Default 60% creativity
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full bg-[var(--bg-surface-1)] rounded-xl border border-[var(--border-1)]">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--bg-interactive)]"></div>
      <p className="text-[var(--text-secondary)] font-medium animate-pulse">Loading component...</p>
    </div>
  </div>
);

const QuickLinkButton: React.FC<{
  label: string;
  icon: string;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-300"
  >
    <div className="p-3 bg-[var(--bg-surface-3)]/60 border border-[var(--border-2)] rounded-full group-hover:bg-[var(--bg-interactive)]/20 group-hover:border-[var(--border-interactive)] transition-all duration-300">
      <Icon name={icon} className="w-5 h-5" />
    </div>
    <span className="text-xs font-semibold tracking-wide">{label}</span>
  </button>
);

const LandingPage: React.FC<{
  onEnter: () => void;
  onQuickLink: (tab: AppTab) => void;
}> = ({ onEnter, onQuickLink }) => {
  const [isExiting, setIsExiting] = useState(false);
  const { t } = useLanguage();

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(onEnter, 500); // Match animation duration
  };

  const handleQuickLinkClick = (tab: AppTab) => {
    setIsExiting(true);
    setTimeout(() => onQuickLink(tab), 500); // Match animation duration
  };

  return (
    <div className={`fixed inset-0 flex flex-col justify-between z-50 transition-opacity duration-500 overflow-y-auto ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <header className="w-full p-6 z-10">
        <div className="max-w-4xl mx-auto flex justify-center items-center gap-8 md:gap-12">
          <QuickLinkButton label={t('landing_render')} icon="photo" onClick={() => handleQuickLinkClick('exterior')} />
          <QuickLinkButton label={t('landing_edit')} icon="brush" onClick={() => handleQuickLinkClick('edit')} />
          <QuickLinkButton label={t('landing_utils')} icon="bookmark" onClick={() => handleQuickLinkClick('utilities')} />
          <QuickLinkButton label={t('landing_tour')} icon="cursor-arrow-rays" onClick={() => handleQuickLinkClick('virtual_tour')} />
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center z-10 px-4">
        <h1 className="font-montserrat text-7xl md:text-8xl font-bold text-[var(--text-primary)] tracking-wider">{t('app_title')}</h1>
        <button
          onClick={handleEnter}
          className="mt-12 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-white font-bold py-3 px-10 rounded-full text-lg transition-transform duration-300 ease-in-out hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        >
          {t('landing_explore')}
        </button>
      </main>

      <Footer />
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${isActive
        ? 'border-[var(--border-accent)] text-[var(--text-accent)] bg-[var(--bg-surface-1)]'
        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-1)]'
        }`}
    >
      <Icon name={icon} className="w-5 h-5" />
      {label}
    </button>
  );
};

const SantaHat = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 100 100"
    className="absolute -top-6 -right-4 transform rotate-[25deg] drop-shadow-md pointer-events-none"
    style={{ filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}
  >
    <path
      d="M20,80 Q50,30 80,80 L90,90 A20,20 0 0,1 70,100 L30,100 A20,20 0 0,1 10,90 Z"
      fill="#fff"
    />
    <path
      d="M20,80 Q50,30 80,80 Z"
      fill="#B91C1C"
    />
    <circle cx="85" cy="75" r="15" fill="#fff" />
  </svg>
);

const HeaderPeachBlossom = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 100 100"
    className="absolute -top-4 -right-4 transform rotate-[15deg] pointer-events-none"
    style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.3))' }}
  >
    <defs>
      <radialGradient id="peachGradient" cx="50%" cy="50%" r="50%">
        <stop offset="20%" stopColor="#FBCFE8" /> {/* pink-200 */}
        <stop offset="90%" stopColor="#EC4899" /> {/* pink-500 */}
        <stop offset="100%" stopColor="#BE185D" /> {/* pink-700 */}
      </radialGradient>
    </defs>

    <g>
      <path d="M50,45 C35,30 30,15 50,5 C70,15 65,30 50,45 Z" fill="url(#peachGradient)" transform="rotate(0, 50, 50)" />
      <path d="M50,45 C35,30 30,15 50,5 C70,15 65,30 50,45 Z" fill="url(#peachGradient)" transform="rotate(72, 50, 50)" />
      <path d="M50,45 C35,30 30,15 50,5 C70,15 65,30 50,45 Z" fill="url(#peachGradient)" transform="rotate(144, 50, 50)" />
      <path d="M50,45 C35,30 30,15 50,5 C70,15 65,30 50,45 Z" fill="url(#peachGradient)" transform="rotate(216, 50, 50)" />
      <path d="M50,45 C35,30 30,15 50,5 C70,15 65,30 50,45 Z" fill="url(#peachGradient)" transform="rotate(288, 50, 50)" />
      <circle cx="50" cy="50" r="10" fill="#FDE047" /> {/* yellow-300 */}
    </g>
  </svg>
);

const HeaderYellowVanIcon = () => (
  <div className="absolute -top-5 -right-6 pointer-events-none transform rotate-12 drop-shadow-md">
    <Icon name="van" className="w-10 h-10" />
  </div>
);

function AppContent() {
  const [showApp, setShowApp] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('exterior');
  const [imageForEditing, setImageForEditing] = useState<SourceImage | null>(null);
  const [editHistoryItemToRestore, setEditHistoryItemToRestore] = useState<EditHistoryItem | null>(null);
  const [theme, setTheme] = useState<Theme>('architecture');
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);
  const { addToast } = useToast();
  const [imageCount, setImageCount] = useState(0);
  const { t, language, setLanguage } = useLanguage();
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem('cpgvn_gemini_api_key');
    if (!key) {
      setIsApiKeyModalOpen(true);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    updateGeminiApiKey(key);
    setIsApiKeyModalOpen(false);
    addToast({ type: 'success', title: 'Success', message: t('api_key_success') });
  };

  const RENDER_HISTORY_LIMIT = 5;
  const EDIT_HISTORY_LIMIT = 3;

  const [tabStates, setTabStates] = useState<Record<RenderTab, RenderTabState>>({
    exterior: { ...initialTabState, useSketchyStyle: false },
    interior: { ...initialTabState, useSketchyStyle: true },
    masterplan: { ...initialTabState, useSketchyStyle: false },
    floorplan: { ...initialTabState, useSketchyStyle: false },
  });

  const [isSliceOn, setIsSliceOn] = useState(true);
  const [isExteriorSliceOn, setIsExteriorSliceOn] = useState(true);

  const isRenderTab = (tab: string): tab is RenderTab => ['exterior', 'interior', 'masterplan', 'floorplan'].includes(tab as RenderTab);

  const activeTabState = isRenderTab(activeTab) ? tabStates[activeTab] : initialTabState;

  const updateActiveTabState = (update: Partial<RenderTabState>) => {
    if (isRenderTab(activeTab)) {
      setTabStates(prev => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], ...update }
      }));
    }
  };

  const { sourceImage, referenceImage, generatedImages, selectedImageIndex, creativityLevel } = activeTabState;
  const setSourceImage = (img: SourceImage | null) => updateActiveTabState({ sourceImage: img });
  const setReferenceImage = (img: SourceImage | null) => updateActiveTabState({ referenceImage: img });
  const setGeneratedImages = (imgs: string[]) => updateActiveTabState({ generatedImages: imgs });
  const setSelectedImageIndex = (idx: number) => updateActiveTabState({ selectedImageIndex: idx });
  const setCreativityLevel = (level: number) => updateActiveTabState({ creativityLevel: level });

  const [numImages, setNumImages] = useState(4);
  const [aspectRatio, setAspectRatio] = useState('Auto');

  // Exterior prompts state
  const [exteriorCustomPrompt, setExteriorCustomPrompt] = useState('');
  const [exteriorContext, setExteriorContext] = useState('');
  const [exteriorLighting, setExteriorLighting] = useState('');
  const [exteriorTone, setExteriorTone] = useState('');
  const [exteriorWeather, setExteriorWeather] = useState('');
  const [exteriorPrompt, setExteriorPrompt] = useState('Ảnh chụp thực tế công trình');

  // Interior prompts state
  const [isConvertingToSketch, setIsConvertingToSketch] = useState(false);
  const [interiorPrompt, setInteriorPrompt] = useState('');
  const [interiorFunction, setInteriorFunction] = useState('');
  const [interiorFunctionCustom, setInteriorFunctionCustom] = useState('');
  const [interiorStyle, setInteriorStyle] = useState('');
  const [interiorStyleCustom, setInteriorStyleCustom] = useState('');
  const [interiorLighting, setInteriorLighting] = useState('');
  const [interiorLightingCustom, setInteriorLightingCustom] = useState('');

  // Layout 3D (Floorplan) states
  const [layout3DBuildingStyle, setLayout3DBuildingStyle] = useState('Căn hộ');
  const [layout3DAngleStyle, setLayout3DAngleStyle] = useState('Top-down View');
  const [layout3DInteriorStyle, setLayout3DInteriorStyle] = useState('Hiện đại');
  const [layout3DLighting, setLayout3DLighting] = useState('Ban ngày (Nắng nhẹ)');
  const [layout3DGeneratedPrompt, setLayout3DGeneratedPrompt] = useState('');
  const [isAnalyzingLayout, setIsAnalyzingLayout] = useState(false);

  const [anglePrompt, setAnglePrompt] = useState("");
  const angleSectionRef = React.useRef<HTMLDivElement>(null);

  const [exteriorHistory, setExteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [interiorHistory, setInteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [masterplanHistory, setMasterplanHistory] = useState<RenderHistoryItem[]>([]);
  const [floorplanHistory, setFloorplanHistory] = useState<RenderHistoryItem[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [utilitiesHistory, setUtilitiesHistory] = useState<RenderHistoryItem[]>([]);
  const [presentationBoardHistory, setPresentationBoardHistory] = useState<RenderHistoryItem[]>([]);
  const [diagramHistory, setDiagramHistory] = useState<RenderHistoryItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
  const [upscaledImageForModal, setUpscaledImageForModal] = useState<string | null>(null);
  const [fullscreenState, setFullscreenState] = useState<{ images: string[]; startIndex: number } | null>(null);

  const [initialUtility, setInitialUtility] = useState<string | null>(null);
  const [videoTabSourceImage, setVideoTabSourceImage] = useState<SourceImage | null>(null);

  const [promptFinderImage, setPromptFinderImage] = useState<SourceImage | null>(null);
  const [promptFinderPrompts, setPromptFinderPrompts] = useState<string>("");
  const [finishMyBuildImage, setFinishMyBuildImage] = useState<SourceImage | null>(null);
  const [finishMyBuildPrompts, setFinishMyBuildPrompts] = useState<string[] | null>(null);
  const [finishInteriorImage, setFinishInteriorImage] = useState<SourceImage | null>(null);
  const [finishInteriorPrompts, setFinishInteriorPrompts] = useState<string[] | null>(null);
  const [mapTo3DImage, setMapTo3DImage] = useState<SourceImage | null>(null);

  const [presentationBoardImage, setPresentationBoardImage] = useState<SourceImage | null>(null);
  const [presentationBoardResults, setPresentationBoardResults] = useState<string[]>([]);

  const [diagramImage, setDiagramImage] = useState<SourceImage | null>(null);
  const [diagramReferenceImage, setDiagramReferenceImage] = useState<SourceImage | null>(null);
  const [diagramResults, setDiagramResults] = useState<string[]>([]);

  const handleQuickLink = (tab: AppTab) => {
    setActiveTab(tab);
    setShowApp(true);
  };

  useEffect(() => {
    const savedCount = localStorage.getItem('cpgvn_image_generation_count');
    setImageCount(savedCount ? parseInt(savedCount, 10) : 0);
  }, []);

  const incrementImageCount = useCallback((amount: number) => {
    setImageCount(prevCount => {
      const newCount = prevCount + amount;
      localStorage.setItem('cpgvn_image_generation_count', String(newCount));
      return newCount;
    });
  }, []);

  const resetImageCount = useCallback(() => {
    if (window.confirm('Reset counter?')) {
      setImageCount(0);
      localStorage.setItem('cpgvn_image_generation_count', '0');
      addToast({ type: 'info', title: 'Reset', message: 'Counter reset.' });
    }
  }, [addToast]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (['dark', 'light', 'orange', 'christmas', 'tet', 'beach', 'architecture'].includes(savedTheme || '')) {
      setTheme(savedTheme as Theme);
    } else {
      setTheme('architecture');
    }
  }, []);

  useEffect(() => {
    document.body.classList.remove('light', 'orange', 'christmas', 'tet', 'beach', 'architecture');
    if (theme !== 'dark') {
      document.body.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Options arrays
  const exteriorContextOptions = ["Trên một con phố", "Vùng nông thôn", "Khu đô thị cao cấp", "Ngã 4 đường phố", "Khu vườn nhiệt đới", "Cạnh con đường làng", "Khu vườn kiểu châu Âu", "Vùng đồi núi"];
  const exteriorLightingOptions = ["Hoàng hôn", "Bầu trời u ám (Overcast)", "Vừa mưa xong", "Bình minh", "Ban đêm", "Ban ngày nắng gắt", "Sương mù", "Golden Hour"];
  const exteriorWeatherOptions = ["Trong lành", "Mưa nhẹ", "Tuyết rơi", "Sương mù"];
  const exteriorToneOptions = ["Đen trắng", "Điện ảnh", "Tự nhiên", "Ấm áp", "Lạnh hiện đại", "Vintage", "Pastel", "Futuristic"];

  const interiorFunctionOptions = ["Phòng khách", "Phòng ngủ", "Nhà bếp", "Phòng tắm", "Phòng làm việc", "Phòng ăn", "Lối vào", "Khác..."];
  const interiorStyleOptions = ["Hiện đại", "Tối giản", "Tân cổ điển", "Indochine", "Scandinavian", "Wabi-sabi", "Bohemian", "Công nghiệp", "Khác..."];
  const interiorLightingOptions = ["Ban ngày tự nhiên", "Hoàng hôn ấm áp", "Nhân tạo ban đêm", "Studio", "Nắng gắt", "U ám", "Khác..."];

  useEffect(() => {
    if (activeTab === 'exterior') {
      const base = 'Ảnh chụp thực tế công trình';
      const additionalParts = [
        exteriorCustomPrompt,
        exteriorContext,
        exteriorLighting,
        exteriorTone,
        exteriorWeather,
      ].filter(p => p && p.trim() !== '');

      let finalPrompt = base;
      if (additionalParts.length > 0) {
        finalPrompt += ', ' + additionalParts.join(', ');
      }
      setExteriorPrompt(finalPrompt);
    }
  }, [exteriorCustomPrompt, exteriorContext, exteriorLighting, exteriorTone, exteriorWeather, activeTab]);

  useEffect(() => {
    if (activeTab === 'interior') {
      const func = interiorFunction === 'Khác...' ? interiorFunctionCustom : interiorFunction;
      const style = interiorStyle === 'Khác...' ? interiorStyleCustom : interiorStyle;
      const light = interiorLighting === 'Khác...' ? interiorLightingCustom : interiorLighting;

      const parts = ['tạo ảnh chụp thực tế của căn phòng', func, style, light].filter(p => p && p.trim() !== '');
      setInteriorPrompt(parts.join(', '));
    }
  }, [activeTab, interiorFunction, interiorFunctionCustom, interiorStyle, interiorStyleCustom, interiorLighting, interiorLightingCustom]);

  useEffect(() => {
    const loadHistory = <T,>(key: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      try {
        const storedHistory = localStorage.getItem(key);
        if (storedHistory) setter(JSON.parse(storedHistory).filter(Boolean));
      } catch (error) { localStorage.removeItem(key); }
    };
    loadHistory('exteriorRenderHistory', setExteriorHistory);
    loadHistory('interiorRenderHistory', setInteriorHistory);
    loadHistory('masterplanHistory', setMasterplanHistory);
    loadHistory('floorplanHistory', setFloorplanHistory);
    loadHistory('editHistory', setEditHistory);
    loadHistory('utilitiesHistory', setUtilitiesHistory);
    loadHistory('presentationBoardHistory', setPresentationBoardHistory);
    loadHistory('diagramHistory', setDiagramHistory);
  }, []);

  useEffect(() => { saveToLocalStorage('exteriorRenderHistory', exteriorHistory); }, [exteriorHistory]);
  useEffect(() => { saveToLocalStorage('interiorRenderHistory', interiorHistory); }, [interiorHistory]);
  useEffect(() => { saveToLocalStorage('masterplanHistory', masterplanHistory); }, [masterplanHistory]);
  useEffect(() => { saveToLocalStorage('floorplanHistory', floorplanHistory); }, [floorplanHistory]);
  useEffect(() => { saveToLocalStorage('editHistory', editHistory); }, [editHistory]);
  useEffect(() => { saveToLocalStorage('utilitiesHistory', utilitiesHistory); }, [utilitiesHistory]);
  useEffect(() => { saveToLocalStorage('presentationBoardHistory', presentationBoardHistory); }, [presentationBoardHistory]);
  useEffect(() => { saveToLocalStorage('diagramHistory', diagramHistory); }, [diagramHistory]);

  const saveToLocalStorage = (key: string, data: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { }
  };


  const handleInteriorImageUpload = (image: SourceImage | null) => {
    setTabStates(prev => ({ ...prev, interior: { ...initialTabState, sourceImage: image } }));
  };

  const dataUrlToSourceImage = (dataUrl: string): SourceImage | null => {
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    return (match && match[1] && match[2]) ? { mimeType: match[1], base64: match[2] } : null;
  }

  const handleStyleConversion = useCallback(async (style: 'sketch' | 'pencil' | 'watercolor') => {
    const source = tabStates.interior.sourceImage;
    if (!source) return;
    setIsConvertingToSketch(true);
    // Clear generated images so the UI falls back to showing the style conversion result
    setTabStates(prev => ({ ...prev, interior: { ...prev.interior, generatedImages: [] } }));

    try {
      const result = await convertToStyle(source, style);
      if (result) {
        setTabStates(prev => ({
          ...prev,
          interior: {
            ...prev.interior,
            sketchyImage: dataUrlToSourceImage(result)
          }
        }));
        incrementImageCount(1);
        addToast({ type: 'success', title: 'Thành Công', message: 'Đã chuyển đổi phong cách thành công.' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Lỗi', message: 'Không thể chuyển đổi phong cách.' });
    } finally {
      setIsConvertingToSketch(false);
    }
  }, [tabStates.interior.sourceImage, addToast, incrementImageCount]);

  const handleExteriorStyleConversion = useCallback(async (style: 'sketch' | 'pencil' | 'watercolor') => {
    const source = tabStates.exterior.sourceImage;
    if (!source) return;
    setIsConvertingToSketch(true);
    // Clear generated images so the UI falls back to showing the style conversion result
    setTabStates(prev => ({ ...prev, exterior: { ...prev.exterior, generatedImages: [] } }));

    try {
      const result = await convertToStyle(source, style);
      if (result) {
        setTabStates(prev => ({
          ...prev,
          exterior: {
            ...prev.exterior,
            sketchyImage: dataUrlToSourceImage(result)
          }
        }));
        incrementImageCount(1);
        addToast({ type: 'success', title: 'Thành Công', message: 'Đã chuyển đổi phong cách thành công.' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Lỗi', message: 'Không thể chuyển đổi phong cách.' });
    } finally {
      setIsConvertingToSketch(false);
    }
  }, [tabStates.exterior.sourceImage, addToast, incrementImageCount]);

  const handleConvertToSketchyStyle = useCallback(async (tab: 'interior' | 'exterior') => {
    const source = tabStates[tab as 'interior' | 'exterior'].sourceImage;
    if (!source) return;
    setIsConvertingToSketch(true);
    try {
      const sketchyImg = await convertToSketchyStyle(source, tab as 'interior' | 'exterior');
      if (sketchyImg) {
        setTabStates(prev => ({ ...prev, [tab]: { ...prev[tab as 'interior' | 'exterior'], sketchyImage: dataUrlToSourceImage(sketchyImg) } }));
        incrementImageCount(1);
      }
    } catch (error) { addToast({ type: 'error', title: 'Error', message: 'Conversion failed.' }); } finally { setIsConvertingToSketch(false); }
  }, [tabStates, addToast, incrementImageCount]);

  const handleGeneration = useCallback(async (prompt: string, renderType: RenderTab, isAnglePrompt: boolean) => {
    const currentTabState = tabStates[renderType];
    let imageToRender: SourceImage | null = null;

    if (renderType === 'floorplan' || renderType === 'masterplan') {
      imageToRender = currentTabState.sourceImage;
    } else {
      imageToRender = currentTabState.useSketchyStyle ? currentTabState.sketchyImage : currentTabState.sourceImage;
    }

    if (!imageToRender) {
      imageToRender = currentTabState.sourceImage;
    }

    if (!imageToRender || !prompt) {
      addToast({ type: 'warning', title: 'Missing Info', message: 'Please upload image and prompt.' });
      return;
    }

    setIsLoading(true);
    updateActiveTabState({ generatedImages: [], selectedImageIndex: 0 });

    try {
      const images = await generateImages(
        imageToRender,
        prompt,
        renderType === 'masterplan' ? 'floorplan' : renderType,
        numImages,
        aspectRatio,
        isAnglePrompt ? null : currentTabState.referenceImage,
        isAnglePrompt,
        currentTabState.creativityLevel
      );
      updateActiveTabState({ generatedImages: images });

      incrementImageCount(images.length);
      const newHistoryItem: RenderHistoryItem = { id: Date.now(), timestamp: new Date().toLocaleTimeString(), images, prompt };
      if (renderType === 'exterior') setExteriorHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
      else if (renderType === 'interior') setInteriorHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
      else if (renderType === 'masterplan') setMasterplanHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
      else if (renderType === 'floorplan') setFloorplanHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
      addToast({ type: 'success', title: 'Success', message: `Generated ${images.length} images!` });
    } catch (error) {
      console.error(error);
      addToast({ type: 'error', title: 'Failed', message: 'Generation failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [tabStates, numImages, aspectRatio, RENDER_HISTORY_LIMIT, addToast, incrementImageCount]);

  const handleAnalyzeLayout = async () => {
    if (!tabStates.floorplan.sourceImage) {
      addToast({ type: 'warning', title: 'Thiếu Ảnh', message: 'Vui lòng tải ảnh Layout 2D lên trước.' });
      return;
    }
    setIsAnalyzingLayout(true);
    try {
      const prompt = await analyzeLayout3DPrompt(
        tabStates.floorplan.sourceImage,
        tabStates.floorplan.referenceImage,
        layout3DBuildingStyle,
        layout3DAngleStyle,
        layout3DInteriorStyle,
        layout3DLighting
      );
      setLayout3DGeneratedPrompt(prompt);
      addToast({ type: 'success', title: 'Thành Công', message: 'Đã phân tích mặt bằng và tạo prompt chuyên nghiệp.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Lỗi', message: 'Không thể phân tích mặt bằng.' });
    } finally {
      setIsAnalyzingLayout(false);
    }
  };

  const handleUpscale = useCallback(async (index: number, target: '2k' | '4k') => {
    const currentImages = activeTabState.generatedImages;
    const sourceDataUrl = currentImages[index];

    if (!sourceDataUrl) return;
    const imageToUpscale = dataUrlToSourceImage(sourceDataUrl);
    if (!imageToUpscale) return;

    setUpscalingIndex(index);
    try {
      const upscaledImage = await upscaleImage(imageToUpscale, target);
      if (upscaledImage) {
        if (isRenderTab(activeTab)) {
          setTabStates(prev => {
            const newImages = [...prev[activeTab].generatedImages];
            newImages[index] = upscaledImage;
            return {
              ...prev,
              [activeTab]: {
                ...prev[activeTab],
                generatedImages: newImages
              }
            };
          });
        }
        setUpscaledImageForModal(upscaledImage);
        incrementImageCount(1);
      }
    } catch (error) { addToast({ type: 'error', title: 'Failed', message: 'Upscale failed.' }); } finally { setUpscalingIndex(null); }
  }, [activeTab, activeTabState.generatedImages, addToast, incrementImageCount]);

  const clearRenderHistory = (type: RenderTab) => {
    if (window.confirm(t('hist_clear') + '?')) {
      if (type === 'exterior') setExteriorHistory([]);
      else if (type === 'interior') setInteriorHistory([]);
      else if (type === 'masterplan') setMasterplanHistory([]);
      else if (type === 'floorplan') setFloorplanHistory([]);
    }
  }

  const handleSelectRenderHistoryItem = useCallback((item: RenderHistoryItem, type: RenderTab) => {
    if (type === 'exterior') { setExteriorPrompt(item.prompt); setExteriorCustomPrompt(item.prompt); }
    else if (type === 'interior') setInteriorPrompt(item.prompt);
    else if (type === 'floorplan') setLayout3DGeneratedPrompt(item.prompt);
    setTabStates(prev => ({ ...prev, [type]: { ...prev[type], generatedImages: item.images, selectedImageIndex: 0 } }));
    setActiveTab(type);
  }, []);

  const handleEditRequest = useCallback((imageUrl: string) => {
    const imageToEdit = dataUrlToSourceImage(imageUrl);
    if (imageToEdit) { setImageForEditing(imageToEdit); setActiveTab('edit'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }, []);

  const handleChangeAngle = useCallback((index: number) => {
    const imageUrl = generatedImages[index];
    if (imageUrl) {
      setSourceImage(dataUrlToSourceImage(imageUrl));
      setReferenceImage(null);
      angleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [generatedImages]);

  const handleFullscreen = useCallback((index: number) => {
    if (generatedImages.length > 0) setFullscreenState({ images: generatedImages, startIndex: index });
  }, [generatedImages]);

  const handleCreateVideoRequest = useCallback((imageUrl: string) => {
    const imageToUse = dataUrlToSourceImage(imageUrl);
    if (imageToUse) { setVideoTabSourceImage(imageToUse); setInitialUtility('create_video'); setActiveTab('utilities'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }, []);

  const handleStartNewRenderFlow = (image: SourceImage, prompt: string = '') => {
    setTabStates(prev => ({
      ...prev,
      exterior: { ...initialTabState, sourceImage: image }
    }));
    if (prompt) {
      setExteriorCustomPrompt(prompt);
      setExteriorPrompt(prompt);
      setIsExteriorSliceOn(false); // Open sections to see the prompt
    }
    setActiveTab('exterior');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditComplete = (details: Omit<EditHistoryItem, 'id' | 'timestamp'>) => {
    const newHistoryItem: EditHistoryItem = { id: Date.now(), timestamp: new Date().toLocaleTimeString(), ...details };
    setEditHistory(prev => [newHistoryItem, ...prev].slice(0, EDIT_HISTORY_LIMIT));
  };

  const clearEditHistory = () => { if (window.confirm(t('hist_clear') + '?')) setEditHistory([]); };

  const handleSelectEditHistoryItem = (item: EditHistoryItem) => {
    setEditHistoryItemToRestore(item);
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUtilityGenerationComplete = useCallback((prompt: string, images: string[]) => {
    const newHistoryItem: RenderHistoryItem = { id: Date.now(), timestamp: new Date().toLocaleTimeString(), images, prompt, };
    setUtilitiesHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
    const isPresentationBoardPrompt = prompt.includes("presentation board") || prompt.includes("Dàn Trang");
    if (isPresentationBoardPrompt) {
      setPresentationBoardHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
    }
    const isDiagramPrompt = ["axonometric", "diagram", "phân tích"].some(keyword => prompt.toLowerCase().includes(keyword));
    if (isDiagramPrompt) {
      setDiagramHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
    }

    incrementImageCount(images.length);
  }, [RENDER_HISTORY_LIMIT, incrementImageCount]);

  const clearUtilitiesHistory = () => { if (window.confirm(t('hist_clear') + '?')) setUtilitiesHistory([]); };
  const clearPresentationBoardHistory = () => { if (window.confirm(t('hist_clear') + '?')) setPresentationBoardHistory([]); };
  const clearDiagramHistory = () => { if (window.confirm(t('hist_clear') + '?')) setDiagramHistory([]); };


  const handleVisualAngleSelect = (prompt: string) => { setAnglePrompt(prompt); };

  const isBusy = isLoading || upscalingIndex !== null || isConvertingToSketch;

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

  const onSelectImageIndex = useCallback((index: number) => {
    updateActiveTabState({ selectedImageIndex: index });
  }, [activeTab]);

  return (
    <>
      {!showApp && <LandingPage onEnter={() => setShowApp(true)} onQuickLink={handleQuickLink} />}
      {showApp &&
        <div className="min-h-screen p-8 fade-in-up flex flex-col">
          <header className="text-center mb-10 relative">
            <button onClick={() => setShowApp(false)} className="absolute top-1/2 left-0 -translate-y-1/2 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-1)] transition-all duration-200" aria-label="Back">
              <Icon name="arrow-uturn-left" className="w-8 h-8" />
            </button>
            <h1 className="relative inline-block text-3xl md:text-4xl font-bold tracking-wider text-[var(--text-primary)] uppercase font-montserrat">
              {t('app_title')}
              {theme === 'christmas' && <SantaHat />}
              {theme === 'tet' && <HeaderPeachBlossom />}
              {theme === 'beach' && <HeaderYellowVanIcon />}
            </h1>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 flex items-center gap-4">

              <button
                onClick={() => setIsUserGuideOpen(true)}
                className="bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] shadow-lg transition-colors"
                title={t('guide_title')}
              >
                <Icon name="question-mark-circle" className="w-6 h-6" />
              </button>

              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] shadow-lg transition-colors"
                title={t('api_key_title')}
              >
                <Icon name="key" className="w-6 h-6" />
              </button>

              <div className="hidden lg:flex items-center gap-2 bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full px-4 py-2 text-sm shadow-lg">
                <Icon name="photo" className="w-5 h-5 text-[var(--text-accent)]" />
                <span className="font-semibold text-[var(--text-secondary)] whitespace-nowrap">{t('generated_count')}</span>
                <span className="font-bold text-lg text-[var(--text-primary)]">{imageCount}</span>
                <button onClick={resetImageCount} title="Reset" className="ml-2 text-[var(--text-tertiary)] hover:text-[var(--text-danger)] transition-colors"><Icon name="arrow-path" className="w-4 h-4" /></button>
              </div>

              <div className="flex items-center bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full p-1 shadow-lg">
                {(['en', 'vi', 'zh'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === lang ? 'bg-[var(--bg-interactive)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="relative" onMouseLeave={() => setIsThemeSelectorOpen(false)}>
                <div className="flex items-center justify-end bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full shadow-lg">
                  <div className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${isThemeSelectorOpen ? 'max-w-3xl' : 'max-w-0'}`}>
                    <div className="flex items-center gap-1 pl-3 pr-2 whitespace-nowrap">
                      {['architecture', 'dark', 'light', 'beach', 'orange', 'christmas', 'tet'].map(t => (
                        <button key={t} onClick={() => setTheme(t as Theme)} className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-[var(--bg-surface-2)] transition-colors">
                          <div className={`w-4 h-4 rounded-full ${t === 'dark' ? 'bg-slate-800' : t === 'light' ? 'bg-white border' : t === 'orange' ? 'bg-orange-500' : t === 'christmas' ? 'bg-green-600' : t === 'tet' ? 'bg-red-600' : t === 'beach' ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="p-3 rounded-full hover:bg-[var(--bg-surface-2)] transition-colors flex-shrink-0 z-10" onMouseEnter={() => setIsThemeSelectorOpen(true)}>
                    <Icon name="cube" className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto flex-grow w-full">
            <div className="flex justify-center border-b border-[var(--border-2)] mb-8 overflow-x-auto">
              <TabButton label={t('tab_exterior')} icon="photo" isActive={activeTab === 'exterior'} onClick={() => setActiveTab('exterior')} />
              <TabButton label={t('tab_interior')} icon="home" isActive={activeTab === 'interior'} onClick={() => setActiveTab('interior')} />
              <TabButton label={t('tab_masterplan')} icon="rectangle-group" isActive={activeTab === 'masterplan'} onClick={() => setActiveTab('masterplan')} />
              <TabButton label={t('tab_floorplan')} icon="cube" isActive={activeTab === 'floorplan'} onClick={() => setActiveTab('floorplan')} />
              <TabButton label={t('tab_tour')} icon="cursor-arrow-rays" isActive={activeTab === 'virtual_tour'} onClick={() => setActiveTab('virtual_tour')} />
              <TabButton label={t('tab_edit')} icon="brush" isActive={activeTab === 'edit'} onClick={() => setActiveTab('edit')} />
              <TabButton label={t('tab_utils')} icon="bookmark" isActive={activeTab === 'utilities'} onClick={() => { setActiveTab('utilities'); setInitialUtility(null); }} />
            </div>

            <main>
              {/* Exterior Tab */}
              <div className={activeTab === 'exterior' ? 'fade-in-up' : 'hidden'}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 flex flex-col gap-8">
                    <Section title={t('step_1')}>
                      <ImageUpload sourceImage={tabStates.exterior.sourceImage} onImageUpload={(img) => setTabStates(p => ({ ...p, exterior: { ...initialTabState, sourceImage: img, useSketchyStyle: false } }))} onRemove={() => setTabStates(p => ({ ...p, exterior: { ...initialTabState, useSketchyStyle: false } }))} />

                      {/* Style Conversion Buttons */}
                      <div className="grid grid-cols-1 gap-2 mt-4">
                        <button
                          onClick={() => handleExteriorStyleConversion('sketch')}
                          disabled={isBusy || !tabStates.exterior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="brush" className="w-4 h-4" /> Chuyển sang Sketchy Style
                        </button>

                        <button
                          onClick={() => handleExteriorStyleConversion('pencil')}
                          disabled={isBusy || !tabStates.exterior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="pencil" className="w-4 h-4" /> Chuyển sang Vẽ tay chì
                        </button>

                        <button
                          onClick={() => handleExteriorStyleConversion('watercolor')}
                          disabled={isBusy || !tabStates.exterior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="beaker" className="w-4 h-4" /> Chuyển sang Màu nước
                        </button>
                      </div>

                      {/* Slice Mode Toggle */}
                      <div className="mt-6 flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-inner">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">Slice Mode</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-tighter font-mono">(on/off)</span>
                        </div>
                        <button
                          onClick={() => setIsExteriorSliceOn(!isExteriorSliceOn)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800 ${isExteriorSliceOn ? 'bg-amber-500' : 'bg-slate-600'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isExteriorSliceOn ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </Section>

                    {/* Conditional Rendering for Exterior: Only if Slice Mode is OFF OR we have a sketchy image */}
                    {(!isExteriorSliceOn || tabStates.exterior.sketchyImage) && (
                      <div className="fade-in-up space-y-8">
                        <Section title={t('step_2')}>
                          <div className="space-y-4">
                            <ReferenceImageUpload image={tabStates.exterior.referenceImage} onUpload={(img) => setTabStates(p => ({ ...p, exterior: { ...p.exterior, referenceImage: img } }))} onRemove={() => setTabStates(p => ({ ...p, exterior: { ...p.exterior, referenceImage: null } }))} />
                            <textarea value={exteriorCustomPrompt} onChange={(e) => { setExteriorCustomPrompt(e.target.value); setExteriorPrompt(e.target.value); }} placeholder={t('ext_custom_prompt')} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-20 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />
                            <div className="space-y-4">
                              {[
                                { label: t('ext_context'), value: exteriorContext, setter: setExteriorContext, opts: exteriorContextOptions, ph: t('ext_select_context') },
                                { label: t('ext_lighting'), value: exteriorLighting, setter: setExteriorLighting, opts: exteriorLightingOptions, ph: t('ext_select_light') },
                                { label: t('ext_weather'), value: exteriorWeather, setter: setExteriorWeather, opts: exteriorWeatherOptions, ph: t('ext_select_weather') },
                                { label: t('ext_tone'), value: exteriorTone, setter: setExteriorTone, opts: exteriorToneOptions, ph: t('ext_select_tone') }
                              ].map((field, i) => (
                                <div key={i}>
                                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{field.label}</label>
                                  <select onChange={(e) => field.setter(e.target.value)} value={field.value} className={`${selectCommonStyles} pr-10`} style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                    <option value="">{field.ph}</option>
                                    {field.opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <CreativitySlider
                              value={tabStates.exterior.creativityLevel}
                              onChange={(val) => setTabStates(prev => ({ ...prev, exterior: { ...prev.exterior, creativityLevel: val } }))}
                            />
                            {renderOptionsUI}
                            <button onClick={() => handleGeneration(exteriorPrompt, 'exterior', false)} disabled={isBusy} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                              <Icon name="sparkles" className="w-5 h-5" /> {t('btn_generate')}
                            </button>
                          </div>
                        </Section>
                        <div ref={angleSectionRef}>
                          <Section title={t('step_3')}>
                            <div className="space-y-4">
                              <VisualAngleSelector onSelectAngle={handleVisualAngleSelect} selectedAnglePrompt={anglePrompt} mode="exterior" />
                              <div className="relative">
                                <textarea value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} placeholder={t('angle_desc_ph')} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-20 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none pr-10" />
                                <div className="absolute top-2 right-2"><Icon name="pencil" className="w-4 h-4 text-[var(--text-tertiary)]" /></div>
                              </div>
                              <button onClick={() => handleGeneration(anglePrompt, 'exterior', true)} disabled={isBusy} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name="sparkles" className="w-5 h-5" /> {t('res_angle')}
                              </button>
                            </div>
                          </Section>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    {(isLoading || tabStates.exterior.generatedImages.length > 0) ? (
                      <ResultDisplay sourceImage={tabStates.exterior.sketchyImage || tabStates.exterior.sourceImage} images={tabStates.exterior.generatedImages} isLoading={isLoading} onUpscale={handleUpscale} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.exterior.selectedImageIndex} onSelectImageIndex={onSelectImageIndex} onChangeAngle={handleChangeAngle} onFullscreen={handleFullscreen} onCreateVideoRequest={handleCreateVideoRequest} showChangeAngleButton={true} />
                    ) : (
                      <Section title={t('res_title')}>
                        <div className="relative z-10 flex-grow flex items-center justify-center bg-black/20 rounded-lg min-h-[300px] md:min-h-[400px]">
                          {isConvertingToSketch ? (
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                              <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">{t('btn_converting')}</p>
                            </div>
                          ) : tabStates.exterior.sketchyImage ? (
                            <ImageCompareSlider beforeImage={tabStates.exterior.sourceImage ? `data:${tabStates.exterior.sourceImage.mimeType};base64,${tabStates.exterior.sourceImage.base64}` : null} afterImage={`data:${tabStates.exterior.sketchyImage.mimeType};base64,${tabStates.exterior.sketchyImage.base64}`} />
                          ) : (
                            <div className="text-center text-[var(--text-tertiary)] p-8">
                              <Icon name="photo" className="w-16 h-16 mx-auto mb-4 opacity-50" />
                              <p>{t('res_empty')}</p>
                            </div>
                          )}
                        </div>
                      </Section>
                    )
                    }
                    <HistoryPanel title={t('hist_exterior')} history={exteriorHistory} onClear={() => clearRenderHistory('exterior')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'exterior')} emptyText={t('hist_empty')} />
                  </div>
                </div>
              </div>

              {/* Interior Tab */}
              <div className={activeTab === 'interior' ? 'fade-in-up' : 'hidden'}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 flex flex-col gap-8">
                    <Section title={t('step_1')}>
                      <ImageUpload sourceImage={tabStates.interior.sourceImage} onImageUpload={handleInteriorImageUpload} onRemove={() => handleInteriorImageUpload(null)} />

                      {/* Style Conversion Buttons */}
                      <div className="grid grid-cols-1 gap-2 mt-4">
                        <button
                          onClick={() => handleStyleConversion('sketch')}
                          disabled={isBusy || !tabStates.interior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="brush" className="w-4 h-4" /> Chuyển sang Sketchy Style
                        </button>

                        <button
                          onClick={() => handleStyleConversion('pencil')}
                          disabled={isBusy || !tabStates.interior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="pencil" className="w-4 h-4" /> Chuyển sang Vẽ tay chì
                        </button>

                        <button
                          onClick={() => handleStyleConversion('watercolor')}
                          disabled={isBusy || !tabStates.interior.sourceImage}
                          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Icon name="beaker" className="w-4 h-4" /> Chuyển sang Màu nước
                        </button>
                      </div>

                      {/* Slice Mode Toggle */}
                      <div className="mt-6 flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-inner">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">Slice Mode</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-tighter font-mono">(on/off)</span>
                        </div>
                        <button
                          onClick={() => setIsSliceOn(!isSliceOn)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800 ${isSliceOn ? 'bg-amber-500' : 'bg-slate-600'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isSliceOn ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </Section>

                    {/* Conditional Rendering: Only if Slice Mode is OFF OR we have a sketchy image */}
                    {(!isSliceOn || tabStates.interior.sketchyImage) && (
                      <div className="fade-in-up space-y-8">
                        <Section title={t('step_2')}>
                          <div className="space-y-4">
                            <ReferenceImageUpload image={tabStates.interior.referenceImage} onUpload={(img) => setTabStates(p => ({ ...p, interior: { ...p.interior, referenceImage: img } }))} onRemove={() => setTabStates(p => ({ ...p, interior: { ...p.interior, referenceImage: null } }))} />
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('int_function')}</label>
                              <select value={interiorFunction} onChange={(e) => setInteriorFunction(e.target.value)} className={selectCommonStyles} style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                {interiorFunctionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                              {interiorFunction === 'Khác...' && <input type="text" value={interiorFunctionCustom} onChange={e => setInteriorFunctionCustom(e.target.value)} placeholder={t('int_custom_ph')} className="mt-2 w-full bg-[var(--bg-surface-4)] p-2 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('int_style')}</label>
                              <select value={interiorStyle} onChange={(e) => setInteriorStyle(e.target.value)} className={selectCommonStyles} style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                {interiorStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                              {interiorStyle === 'Khác...' && <input type="text" value={interiorStyleCustom} onChange={e => setInteriorStyleCustom(e.target.value)} placeholder={t('int_custom_ph')} className="mt-2 w-full bg-[var(--bg-surface-4)] p-2 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('int_light')}</label>
                              <select value={interiorLighting} onChange={(e) => setInteriorLighting(e.target.value)} className={selectCommonStyles} style={{ backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                {interiorLightingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                              {interiorLighting === 'Khác...' && <input type="text" value={interiorLightingCustom} onChange={e => setInteriorLightingCustom(e.target.value)} placeholder={t('int_custom_ph')} className="mt-2 w-full bg-[var(--bg-surface-4)] p-2 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />}
                            </div>
                            <CreativitySlider
                              value={tabStates.interior.creativityLevel}
                              onChange={(val) => setTabStates(prev => ({ ...prev, interior: { ...prev.interior, creativityLevel: val } }))}
                            />
                            {renderOptionsUI}
                            <button onClick={() => handleGeneration(interiorPrompt, 'interior', false)} disabled={isBusy} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                              <Icon name="sparkles" className="w-5 h-5" /> {t('btn_generate')}
                            </button>
                          </div>
                        </Section>

                        <div ref={angleSectionRef}>
                          <Section title={t('step_3')}>
                            <div className="space-y-4">
                              <VisualAngleSelector onSelectAngle={handleVisualAngleSelect} selectedAnglePrompt={anglePrompt} mode="interior" />
                              <div className="relative">
                                <textarea value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} placeholder={t('angle_desc_ph')} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-20 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none pr-10" />
                                <div className="absolute top-2 right-2"><Icon name="pencil" className="w-4 h-4 text-[var(--text-tertiary)]" /></div>
                              </div>
                              <button onClick={() => handleGeneration(anglePrompt, 'interior', true)} disabled={isBusy} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name="sparkles" className="w-5 h-5" /> {t('res_angle')}
                              </button>
                            </div>
                          </Section>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-8">
                    {(isLoading || tabStates.interior.generatedImages.length > 0) ? (
                      <ResultDisplay sourceImage={tabStates.interior.sketchyImage || tabStates.interior.sourceImage} images={tabStates.interior.generatedImages} isLoading={isLoading} onUpscale={handleUpscale} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.interior.selectedImageIndex} onSelectImageIndex={onSelectImageIndex} onChangeAngle={handleChangeAngle} onFullscreen={handleFullscreen} onCreateVideoRequest={handleCreateVideoRequest} showChangeAngleButton={true} />
                    ) : (
                      <Section title={t('res_title')}>
                        <div className="relative z-10 flex-grow flex items-center justify-center bg-black/20 rounded-lg min-h-[300px] md:min-h-[400px]">
                          {isConvertingToSketch ? (
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                              <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">{t('btn_converting')}</p>
                            </div>
                          ) : tabStates.interior.sketchyImage ? (
                            <ImageCompareSlider beforeImage={tabStates.interior.sourceImage ? `data:${tabStates.interior.sourceImage.mimeType};base64,${tabStates.interior.sourceImage.base64}` : null} afterImage={`data:${tabStates.interior.sketchyImage.mimeType};base64,${tabStates.interior.sketchyImage.base64}`} />
                          ) : (
                            <div className="text-center text-[var(--text-tertiary)] p-8">
                              <Icon name="photo" className="w-16 h-16 mx-auto mb-4 opacity-50" />
                              <p>{t('res_empty')}</p>
                            </div>
                          )}
                        </div>
                      </Section>
                    )
                    }
                    <HistoryPanel title={t('hist_interior')} history={interiorHistory} onClear={() => clearRenderHistory('interior')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'interior')} emptyText={t('hist_empty')} />
                  </div>
                </div>
              </div>

              {/* Masterplan Tab */}
              <div className={activeTab === 'masterplan' ? 'fade-in-up' : 'hidden'}>
                <MasterplanTo3D
                  history={masterplanHistory}
                  onGenerationComplete={(prompt, images) => {
                    const newHistoryItem: RenderHistoryItem = {
                      id: Date.now(),
                      timestamp: new Date().toLocaleTimeString(),
                      images,
                      prompt
                    };
                    setMasterplanHistory(prev => [newHistoryItem, ...prev].slice(0, RENDER_HISTORY_LIMIT));
                    incrementImageCount(images.length);
                  }}
                  onClearHistory={() => clearRenderHistory('masterplan')}
                  onEditRequest={handleEditRequest}
                />
              </div>

              {/* Layout 2D->3D Tab */}
              <div className={activeTab === 'floorplan' ? 'fade-in-up' : 'hidden'}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 flex flex-col gap-8">
                    <Section title="1. Tải Lên Floorplan (2D)">
                      <ImageUpload sourceImage={tabStates.floorplan.sourceImage} onImageUpload={(img) => setTabStates(p => ({ ...p, floorplan: { ...p.floorplan, sourceImage: img } }))} onRemove={() => setTabStates(p => ({ ...p, floorplan: { ...p.floorplan, sourceImage: null, referenceImage: null, generatedImages: [] } }))} />
                    </Section>
                    <Section title="2. Tùy Chọn & Phân Tích">
                      <div className="space-y-4">
                        <ReferenceImageUpload image={tabStates.floorplan.referenceImage} onUpload={(img) => setTabStates(p => ({ ...p, floorplan: { ...p.floorplan, referenceImage: img } }))} onRemove={() => setTabStates(p => ({ ...p, floorplan: { ...p.floorplan, referenceImage: null } }))} />

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Loại công trình</label>
                            <select value={layout3DBuildingStyle} onChange={(e) => setLayout3DBuildingStyle(e.target.value)} className={selectCommonStyles}>
                              <option value="Nhà ở">Nhà ở</option>
                              <option value="Căn hộ">Căn hộ</option>
                              <option value="Biệt thự">Biệt thự</option>
                              <option value="Văn phòng">Văn phòng</option>
                              <option value="Quán cafe">Quán cafe</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Góc nhìn</label>
                            <select value={layout3DAngleStyle} onChange={(e) => setLayout3DAngleStyle(e.target.value)} className={selectCommonStyles}>
                              <option value="Top-down View">Top-down View</option>
                              <option value="Perspective (Chim bay)">Perspective (Chim bay)</option>
                              <option value="Eye-level (Nội thất)">Eye-level (Nội thất)</option>
                              <option value="Isometric">Isometric</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phong cách nội thất</label>
                            <select value={layout3DInteriorStyle} onChange={(e) => setLayout3DInteriorStyle(e.target.value)} className={selectCommonStyles}>
                              <option value="Hiện đại">Hiện đại</option>
                              <option value="Tối giản">Tối giản</option>
                              <option value="Tân cổ điển">Tân cổ điển</option>
                              <option value="Indochine">Indochine</option>
                              <option value="Scandinavian">Scandinavian</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ánh sáng</label>
                            <select value={layout3DLighting} onChange={(e) => setLayout3DLighting(e.target.value)} className={selectCommonStyles}>
                              <option value="Ban ngày (Nắng nhẹ)">Ban ngày (Nắng nhẹ)</option>
                              <option value="Hoàng hôn ấm áp">Hoàng hôn ấm áp</option>
                              <option value="Ban đêm (Đèn điện)">Ban đêm (Đèn điện)</option>
                              <option value="Studio Lighting">Studio Lighting</option>
                            </select>
                          </div>
                        </div>

                        <button onClick={handleAnalyzeLayout} disabled={isAnalyzingLayout || !tabStates.floorplan.sourceImage} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] text-yellow-500 text-xs font-bold py-2.5 rounded-md transition-all border border-yellow-500/30">
                          {isAnalyzingLayout ? "Đang phân tích..." : <><Icon name="sparkles" className="w-4 h-4" /> Phân Tích & Hoàn Thiện Prompt</>}
                        </button>

                        <textarea value={layout3DGeneratedPrompt} onChange={(e) => setLayout3DGeneratedPrompt(e.target.value)} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-32 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" placeholder="Prompt chuyên nghiệp sẽ xuất hiện ở đây sau khi phân tích..." />

                        {renderOptionsUI}

                        <button onClick={() => handleGeneration(layout3DGeneratedPrompt, 'floorplan', false)} disabled={isBusy || !tabStates.floorplan.sourceImage || !layout3DGeneratedPrompt} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                          <Icon name="sparkles" className="w-5 h-5" /> Tạo Ảnh 3D
                        </button>
                      </div>
                    </Section>
                  </div>
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <ResultDisplay sourceImage={tabStates.floorplan.sourceImage} images={tabStates.floorplan.generatedImages} isLoading={isLoading} onUpscale={handleUpscale} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.floorplan.selectedImageIndex} onSelectImageIndex={onSelectImageIndex} onChangeAngle={handleChangeAngle} onFullscreen={handleFullscreen} onCreateVideoRequest={handleCreateVideoRequest} showChangeAngleButton={true} />
                    <HistoryPanel title={t('hist_floorplan')} history={floorplanHistory} onClear={() => clearRenderHistory('floorplan')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'floorplan')} emptyText={t('hist_empty')} />
                  </div>
                </div>
              </div>

              <div className={activeTab === 'virtual_tour' ? 'fade-in-up' : 'hidden'}>
                <Suspense fallback={<LoadingFallback />}>
                  <VirtualTourTab setActiveTab={setActiveTab} setImageForEditing={setImageForEditing} onCreateVideoRequest={handleCreateVideoRequest} onImageGenerated={() => incrementImageCount(1)} />
                </Suspense>
              </div>

              <div className={activeTab === 'edit' ? 'fade-in-up' : 'hidden'}>
                <div className="w-full">
                  <Suspense fallback={<LoadingFallback />}>
                    <ImageEditor
                      initialImage={imageForEditing}
                      onClearInitialImage={() => setImageForEditing(null)}
                      onEditComplete={handleEditComplete}
                      historyItemToRestore={editHistoryItemToRestore}
                      onHistoryRestored={() => setEditHistoryItemToRestore(null)}
                      onCreateVideoRequest={handleCreateVideoRequest}
                      onImageGenerated={() => incrementImageCount(1)}
                    />
                  </Suspense>
                </div>
              </div>

              <div className={activeTab === 'utilities' ? 'fade-in-up' : 'hidden'}>
                <Suspense fallback={<LoadingFallback />}>
                  <UtilitiesTab
                    onEditRequest={handleEditRequest}
                    onStartNewRenderFlow={handleStartNewRenderFlow}
                    promptFinderImage={promptFinderImage}
                    setPromptFinderImage={setPromptFinderImage}
                    promptFinderPrompts={promptFinderPrompts}
                    setPromptFinderPrompts={setPromptFinderPrompts}
                    finishMyBuildImage={finishMyBuildImage}
                    setFinishMyBuildImage={setFinishMyBuildImage}
                    finishMyBuildPrompts={finishMyBuildPrompts}
                    setFinishMyBuildPrompts={setFinishMyBuildPrompts}
                    finishInteriorImage={finishInteriorImage}
                    setFinishInteriorImage={setFinishInteriorImage}
                    finishInteriorPrompts={finishInteriorPrompts}
                    setFinishInteriorPrompts={setFinishInteriorPrompts}
                    mapTo3DImage={mapTo3DImage}
                    setMapTo3DImage={setMapTo3DImage}
                    presentationBoardImage={presentationBoardImage}
                    setPresentationBoardImage={setPresentationBoardImage}
                    presentationBoardResults={presentationBoardResults}
                    setPresentationBoardResults={setPresentationBoardResults}
                    presentationBoardHistory={presentationBoardHistory}
                    onClearPresentationBoardHistory={clearPresentationBoardHistory}
                    diagramImage={diagramImage}
                    setDiagramImage={setDiagramImage}
                    diagramReferenceImage={diagramReferenceImage}
                    setDiagramReferenceImage={setDiagramReferenceImage}
                    diagramResults={diagramResults}
                    setDiagramResults={setDiagramResults}
                    diagramHistory={diagramHistory}
                    onClearDiagramHistory={clearDiagramHistory}
                    history={utilitiesHistory}
                    onClearHistory={clearUtilitiesHistory}
                    onGenerationComplete={handleUtilityGenerationComplete}
                    initialUtility={initialUtility}
                    setInitialUtility={setInitialUtility}
                    videoTabSourceImage={videoTabSourceImage}
                    setVideoTabSourceImage={setVideoTabSourceImage}
                  />
                </Suspense>
              </div>
            </main>

            <Footer />
          </div>

          {upscaledImageForModal && (
            <ImageViewerModal images={[upscaledImageForModal]} startIndex={0} onClose={() => setUpscaledImageForModal(null)} />
          )}
          {fullscreenState && (
            <ImageViewerModal images={fullscreenState.images} startIndex={fullscreenState.startIndex} onClose={() => setFullscreenState(null)} />
          )}
          {isUserGuideOpen && (
            <UserGuideModal onClose={() => setIsUserGuideOpen(false)} />
          )}
          <ApiKeyModal
            isOpen={isApiKeyModalOpen}
            onClose={() => setIsApiKeyModalOpen(false)}
            onSave={handleSaveApiKey}
            initialKey={localStorage.getItem('cpgvn_gemini_api_key') || ''}
          />
        </div>
      }
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
