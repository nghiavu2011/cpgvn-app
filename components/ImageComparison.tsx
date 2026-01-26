
import React from 'react';
import { ImageCompareSlider } from './Shared';
import { Icon } from './icons';

interface ImageComparisonProps {
    before: string;
    after: string;
    onClose: () => void;
    language?: string;
}

const ImageComparison: React.FC<ImageComparisonProps> = ({ before, after, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8" onClick={onClose}>
            <div className="relative w-full max-w-5xl h-[80vh] bg-gray-900 rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                >
                    <Icon name="x-mark" className="w-6 h-6" />
                </button>
                <ImageCompareSlider beforeImage={before} afterImage={after} />
            </div>
        </div>
    );
};

export default ImageComparison;
