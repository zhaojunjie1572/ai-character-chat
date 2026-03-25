'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, Crop, ZoomIn, ZoomOut, RotateCw, Check, Image as ImageIcon } from 'lucide-react';

interface AvatarMakerProps {
  onSave: (avatarUrl: string) => void;
  onCancel: () => void;
}

export function AvatarMaker({ onSave, onCancel }: AvatarMakerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const generateAvatar = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置输出尺寸 - 压缩到极致的小尺寸
    const size = 128;
    canvas.width = size;
    canvas.height = size;

    const img = imageRef.current;
    
    // 保存上下文状态
    ctx.save();
    
    // 移动到画布中心
    ctx.translate(size / 2, size / 2);
    
    // 应用旋转
    ctx.rotate((rotation * Math.PI) / 180);
    
    // 计算缩放后的尺寸
    const scale = zoom;
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    
    // 计算绘制位置（考虑裁剪偏移）
    const drawX = -scaledWidth / 2 + crop.x * scale;
    const drawY = -scaledHeight / 2 + crop.y * scale;
    
    // 创建圆形裁剪路径
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // 绘制图片
    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
    
    // 恢复上下文
    ctx.restore();

    // 导出为压缩后的 JPEG
    const avatarUrl = canvas.toDataURL('image/jpeg', 0.6);
    onSave(avatarUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            制作头像
          </h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!image ? (
          <div className="text-center py-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300"
            >
              <Upload className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">点击上传图片</p>
            <p className="text-xs text-gray-400">支持 JPG、PNG、GIF 格式</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 预览区域 */}
            <div 
              className="relative w-64 h-64 mx-auto bg-gray-100 rounded-full overflow-hidden cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={image}
                alt="预览"
                className="absolute max-w-none"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                draggable={false}
              />
              {/* 圆形遮罩边框 */}
              <div className="absolute inset-0 border-4 border-white rounded-full pointer-events-none shadow-inner" />
            </div>

            {/* 控制按钮 */}
            <div className="flex justify-center gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="缩小"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="放大"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="旋转"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setImage(null);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setRotation(0);
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="重新选择"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              拖动图片调整位置，使用按钮缩放和旋转
            </p>

            {/* 隐藏的画布用于生成最终头像 */}
            <canvas ref={canvasRef} className="hidden" />

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={generateAvatar}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                确认使用
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
