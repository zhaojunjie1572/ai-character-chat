'use client';

import { Search, Plus, X } from 'lucide-react';

interface HeaderProps {
  activeTab: 'wechat' | 'contacts' | 'discover' | 'me';
  showSearch: boolean;
  searchKeyword: string;
  showMoreMenu: boolean;
  onToggleSearch: () => void;
  onSearchChange: (value: string) => void;
  onToggleMoreMenu: () => void;
  onShowForm: () => void;
  onShowSettings: () => void;
}

export function Header({
  activeTab,
  showSearch,
  searchKeyword,
  showMoreMenu,
  onToggleSearch,
  onSearchChange,
  onToggleMoreMenu,
  onShowForm,
  onShowSettings,
}: HeaderProps) {
  return (
    <header className="bg-[#EDEDED] border-b border-gray-300 flex items-center justify-between px-4 h-14 shrink-0">
      {showSearch ? (
        <div className="flex-1 flex items-center gap-2">
          <button
            onClick={() => {
              onToggleSearch();
              onSearchChange('');
            }}
            className="p-1"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <input
            type="text"
            autoFocus
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索"
            className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm outline-none"
          />
        </div>
      ) : (
        <>
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900">
            {activeTab === 'wechat' && '微信'}
            {activeTab === 'contacts' && '通讯录'}
            {activeTab === 'discover' && '发现'}
            {activeTab === 'me' && '我'}
          </h1>
          <div className="flex items-center gap-2">
            {activeTab === 'wechat' && (
              <button onClick={onToggleSearch} className="p-1.5 hover:bg-gray-200 rounded-full">
                <Search className="w-5 h-5 text-gray-700" />
              </button>
            )}
            {(activeTab === 'wechat' || activeTab === 'contacts') && (
              <div className="relative">
                <button
                  onClick={onToggleMoreMenu}
                  className="p-1.5 hover:bg-gray-200 rounded-full"
                >
                  <Plus className="w-5 h-5 text-gray-700" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-10 bg-white rounded-md shadow-xl py-1 min-w-[140px] z-50">
                    {activeTab === 'wechat' && (
                      <button
                        onClick={() => {
                          onShowForm();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        发起群聊
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onShowForm();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      {activeTab === 'wechat' ? '添加朋友' : '添加角色'}
                    </button>
                    <button
                      onClick={() => {
                        onShowSettings();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      扫一扫
                    </button>
                    <button
                      onClick={() => {
                        onShowSettings();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      收付款
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
