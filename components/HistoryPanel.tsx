
import React from 'react';
import { Icon } from './icons';
import { useLanguage } from './LanguageContext';
import { RenderHistoryItem } from '../types';

interface HistoryPanelProps {
    history: RenderHistoryItem[];
    onClear: () => void;
    onSelect: (item: RenderHistoryItem) => void;
    title: string;
    emptyText: string;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = React.memo(({ history, onClear, onSelect, title, emptyText }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-lg border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          {title}
        </h2>
        {history.length > 0 &&
            <button onClick={onClear} className="text-[var(--text-danger)] hover:text-[var(--text-danger-hover)] text-sm font-semibold flex items-center gap-1">
                <Icon name="trash" className="w-4 h-4" />
                {t('btn_remove')}
            </button>
        }
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-96 pr-2">
          {history.map((item) => (
            <li key={item.id} 
                className="bg-[var(--bg-surface-2)] p-3 rounded-md hover:bg-[var(--bg-surface-3)] cursor-pointer transition-colors"
                onClick={() => onSelect(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow min-w-0 mr-2">
                  <p className="font-semibold text-sm">{item.images.length} ảnh</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate" title={item.prompt}>{item.prompt}</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] self-start flex-shrink-0">{item.timestamp}</p>
              </div>
              <div className="flex overflow-x-auto gap-2 pb-1">
                {item.images.map((image, index) => (
                    <img 
                        key={index} 
                        src={image} 
                        alt={`History thumbnail ${index + 1}`} 
                        className="w-20 h-20 object-cover rounded flex-shrink-0"
                    />
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">{emptyText}</p>
      )}
    </div>
  );
});
