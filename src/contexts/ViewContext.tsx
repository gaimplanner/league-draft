import { createContext, useContext, ReactNode } from 'react';

export type ViewMode = 'admin' | 'public';

const ViewContext = createContext<ViewMode>('admin');

export const useViewMode = () => useContext(ViewContext);

interface ViewProviderProps {
  children: ReactNode;
  mode: ViewMode;
}

export const ViewProvider = ({ children, mode }: ViewProviderProps) => {
  return (
    <ViewContext.Provider value={mode}>
      {children}
    </ViewContext.Provider>
  );
};
