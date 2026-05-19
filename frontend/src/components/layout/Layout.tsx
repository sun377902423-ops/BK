import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

const LayoutInner: React.FC = () => {
  const { collapsed } = useSidebar();
  return (
    <div className={`flex h-screen bg-gray-50 transition-all duration-300 ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const Layout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
};

export default Layout;
