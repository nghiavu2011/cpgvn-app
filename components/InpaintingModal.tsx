
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

export interface InpaintingModalRef {
    snapshot: () => { composite: string; mask: string };
    undo: () => void;
    clearMask: () => void;
}

interface InpaintingModalProps {
    width: number;
    height: number;
    backgroundImage: string;
    mode: 'brush' | 'eraser';
    brushSize: number;
    brushOpacity: number;
    activeColor: string;
    onSnapshot: (data: { composite: string; mask: string }) => void;
}

const InpaintingModal = forwardRef<InpaintingModalRef, InpaintingModalProps>(({
    width, height, backgroundImage, mode, brushSize, brushOpacity, activeColor, onSnapshot
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [history, setHistory] = useState<ImageData[]>([]);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    // Initial load
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Clear and setup
        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Save initial blank state
        setHistory([ctx.getImageData(0, 0, width, height)]);
    }, [width, height]);

    useImperativeHandle(ref, () => ({
        snapshot: () => {
            const canvas = canvasRef.current;
            if (!canvas) return { composite: '', mask: '' };

            // Mask Base64 (Transparent with color strokes)
            // const maskBase64 = canvas.toDataURL('image/png'); // unused

            // To create B/W mask for AI:
            const bwCanvas = document.createElement('canvas');
            bwCanvas.width = width;
            bwCanvas.height = height;
            const bwCtx = bwCanvas.getContext('2d');
            if (bwCtx) {
                bwCtx.fillStyle = 'black';
                bwCtx.fillRect(0, 0, width, height);
                bwCtx.drawImage(canvas, 0, 0);
                bwCtx.globalCompositeOperation = 'source-in';
                bwCtx.fillStyle = 'white';
                bwCtx.fillRect(0, 0, width, height);
            }
            const bwMaskBase64 = bwCanvas.toDataURL('image/png');

            return { composite: backgroundImage, mask: bwMaskBase64 };
        },
        undo: () => {
            if (history.length > 1) {
                const newHistory = [...history];
                newHistory.pop(); // Remove current
                const previousState = newHistory[newHistory.length - 1];
                setHistory(newHistory);
                
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx && previousState) {
                    ctx.putImageData(previousState, 0, 0);
                }
            }
        },
        clearMask: () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
            }
        }
    }));

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        // Scale logic
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawing.current = true;
        const { x, y } = getCoords(e);
        lastPos.current = { x, y };
        
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y); // Dot
            ctx.stroke();
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = mode === 'eraser' ? 'rgba(0,0,0,1)' : activeColor;
        ctx.globalCompositeOperation = mode === 'eraser' ? 'destination-out' : 'source-over';
        ctx.globalAlpha = mode === 'eraser' ? 1 : brushOpacity;

        ctx.beginPath();
        if (lastPos.current) {
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();

        lastPos.current = { x, y };
    };

    const stopDrawing = () => {
        if (isDrawing.current) {
            isDrawing.current = false;
            lastPos.current = null;
            // Save state
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                setHistory(prev => [...prev, ctx.getImageData(0, 0, width, height)]);
            }
        }
    };

    return (
        <div className="flex items-center justify-center w-full h-full bg-[#1a1a1a] overflow-hidden p-4">
            <div 
                className="relative shadow-2xl"
                style={{ 
                    aspectRatio: `${width} / ${height}`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
            >
                {/* Background Image - Determines the size of the container */}
                <img 
                    src={backgroundImage} 
                    alt="Background" 
                    className="block w-full h-full object-contain select-none"
                    draggable={false}
                />
                
                {/* Drawing Canvas - Overlays exactly on top */}
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="absolute inset-0 w-full h-full touch-none"
                    style={{
                        cursor: mode === 'eraser' ? 'crosshair' : 'default',
                    }}
                />
            </div>
        </div>
    );
});

export default InpaintingModal;
