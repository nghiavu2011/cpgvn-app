
import React from 'react';
import { Icon } from './icons';
import { useLanguage } from './LanguageContext';
import { EditHistoryItem, SourceImage } from '../types';

interface EditHistoryPanelProps {
    history: EditHistoryItem[];
    onClear: () => void;
    onSelect: (item: EditHistoryItem) => void;
}

export const EditHistoryPanel: React.FC<EditHistoryPanelProps> = ({ history, onClear, onSelect }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          {t('hist_edit')}
        </h2>
        {history.length > 0 &&
            <button onClick={onClear} className="text-[var(--text-danger)] hover:text-[var(--text-danger-hover)] text-sm font-semibold flex items-center gap-1">
                <Icon name="trash" className="w-4 h-4" />
                {t('btn_remove')}
            </button>
        }
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
          {history.map((item) => (
            <li key={item.id} 
                className="bg-[var(--bg-surface-2)] p-3 rounded-md hover:bg-[var(--bg-surface-3)] cursor-pointer transition-colors"
                onClick={() => onSelect(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow min-w-0 mr-2">
                  <p className="font-semibold text-sm truncate" title={item.prompt}>{item.prompt}</p>
                  <p className="text-xs text-[var(--text-secondary)]">1 ảnh đã sửa</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] self-start flex-shrink-0">{item.timestamp}</p>
              </div>
              <div className="flex gap-2">
                <div className="w-1/2 relative">
                    <img 
                        src={`data:${item.sourceImage.mimeType};base64,${item.sourceImage.base64}`} 
                        alt="Source" 
                        className="w-full aspect-square object-cover rounded" 
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">GỐC</span>
                </div>
                <div className="w-1/2 relative">
                    <img 
                        src={item.resultImage} 
                        alt="Result" 
                        className="w-full aspect-square object-cover rounded" 
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">KẾT QUẢ</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">{t('hist_empty')}</p>
      )}
    </div>
  );
};
