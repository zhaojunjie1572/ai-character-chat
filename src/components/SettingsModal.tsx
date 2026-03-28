'use client';

import { X, Check, Key, AlertCircle, Cloud, Download, Upload, RefreshCw } from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS } from '@/store/useSettingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  tempSettings: AppSettings;
  availableVoices: SpeechSynthesisVoice[];
  isSyncing: boolean;
  syncMessage: string;
  syncError: string;
  onClose: () => void;
  onTempSettingsChange: (settings: Partial<AppSettings>) => void;
  onSave: () => void;
  onSyncToGist: () => void;
  onRestoreFromGist: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SettingsModal({
  isOpen,
  tempSettings,
  availableVoices,
  isSyncing,
  syncMessage,
  syncError,
  onClose,
  onTempSettingsChange,
  onSave,
  onSyncToGist,
  onRestoreFromGist,
  onExport,
  onImport,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-gray-900">设置</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-5">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 text-sm">API配置</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">API密钥</label>
              <input
                type="password"
                value={tempSettings.apiKey}
                onChange={(e) => onTempSettingsChange({ apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">API基础URL</label>
              <input
                type="text"
                value={tempSettings.apiBaseURL}
                onChange={(e) => onTempSettingsChange({ apiBaseURL: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">模型</label>
              <input
                type="text"
                value={tempSettings.apiModel}
                onChange={(e) => onTempSettingsChange({ apiModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                placeholder="gpt-3.5-turbo"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              GitHub Gist 同步
            </h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">GitHub Token</label>
              <input
                type="password"
                value={tempSettings.gistToken}
                onChange={(e) => onTempSettingsChange({ gistToken: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                placeholder="ghp_..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Gist ID (留空自动创建)</label>
              <input
                type="text"
                value={tempSettings.gistId}
                onChange={(e) => onTempSettingsChange({ gistId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSyncToGist}
                disabled={isSyncing}
                className="flex-1 px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    同步到 Gist
                  </>
                )}
              </button>
              <button
                onClick={onRestoreFromGist}
                disabled={isSyncing}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                从 Gist 恢复
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-gray-900 text-sm">数据备份</h4>
            <div className="flex gap-2">
              <button
                onClick={onExport}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                导出数据
              </button>
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={onImport}
                  className="hidden"
                />
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm cursor-pointer">
                  <Upload className="w-4 h-4" />
                  导入数据
                </div>
              </label>
            </div>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
            <Check className="w-4 h-4" />
            {syncMessage}
          </div>
        )}
        {syncError && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {syncError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
          >
            关闭
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] text-sm"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
