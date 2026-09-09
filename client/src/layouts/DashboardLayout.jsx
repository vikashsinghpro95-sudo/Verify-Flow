import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, History, Settings } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardLayout() {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Verify Emails', path: '/upload', icon: UploadCloud },
    { name: 'History', path: '/history', icon: History },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-primary-600 flex items-center gap-2">
            <UploadCloud className="w-6 h-6" />
            VerifyFlow
          </h1>
        </div>
        <nav className="mt-6 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => clsx(
                "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                isActive ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
