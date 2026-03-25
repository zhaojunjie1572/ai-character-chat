'use client';

import { Character } from '@/types/character';
import { Edit2, Trash2, MessageCircle } from 'lucide-react';

interface CharacterCardProps {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
}

export function CharacterCard({ character, onEdit, onDelete, onChat }: CharacterCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* 头像 */}
          <div className="relative">
            <img
              src={character.avatar}
              alt={character.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
            />
            <button
              onClick={onChat}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {character.name}
              </h3>
              {character.title && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {character.title}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {character.description || '暂无描述'}
            </p>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-primary-600 hover:bg-white rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          编辑
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </button>
      </div>
    </div>
  );
}
