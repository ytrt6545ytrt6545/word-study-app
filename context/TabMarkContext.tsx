import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type TabKey = 'explore' | 'words' | null;

type TabMarkContextType = {
  markedTab: TabKey;
  setMarkedTab: (tab: TabKey) => void;
};

const TabMarkContext = createContext<TabMarkContextType | undefined>(undefined);

export function TabMarkProvider({ children }: { children: ReactNode }) {
  const [markedTab, setMarkedTab] = useState<TabKey>(null);
  return (
    <TabMarkContext.Provider value={{ markedTab, setMarkedTab }}>
      {children}
    </TabMarkContext.Provider>
  );
}

export function useTabMark() {
  const ctx = useContext(TabMarkContext);
  if (!ctx) throw new Error('useTabMark must be used within TabMarkProvider');
  return ctx;
}

