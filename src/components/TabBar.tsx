'use client';

import { MessageSquare, Users, Compass, User } from 'lucide-react';

interface TabBarProps {
  activeTab: 'wechat' | 'contacts' | 'discover' | 'me';
  onTabChange: (tab: 'wechat' | 'contacts' | 'discover' | 'me') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: 'wechat' as const, icon: MessageSquare, label: '微信' },
    { id: 'contacts' as const, icon: Users, label: '通讯录' },
    { id: 'discover' as const, icon: Compass, label: '发现' },
    { id: 'me' as const, icon: User, label: '我' },
  ];

  return (
    <nav className="bg-[#F7F7F7] border-t border-gray-300 flex items-center justify-around h-14 shrink-0 pb-safe">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[#07C160]' : 'text-gray-600'}`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
