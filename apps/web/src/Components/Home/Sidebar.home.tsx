import { useState } from 'react';
import { Search, Home, FolderOpen, Users, CreditCard, Key, Settings, ChevronLeft, ChevronRight, LogOut, LayoutTemplate, CloudUpload } from 'lucide-react';
import type { User } from '@/State/Types';
import type { NavigateFunction } from 'react-router-dom';

interface Props {
  collapsed: Boolean,
  onToggle : ()=>void,
  user: User,
  activeItem: string,
  onNavigate: (itemKey:string)=>void,
  navigate: NavigateFunction
}

// Updated Sidebar Component with navigation state
const Sidebar = ({ collapsed, onToggle, user, activeItem, onNavigate, navigate }:Props) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const menuItems = {
    create: [
      { icon: Home, label: 'Home', key: 'home' },
      { icon: FolderOpen, label: 'All Projects', key: 'projects' },
      { icon: Users, label: 'Teams', key: 'teams' }
    ],
    billing: [
      { icon: CreditCard, label: 'Pricing', key: 'pricing' },
      { icon: Key, label: 'Add API Keys', key: 'api-keys' }
    ],
    browse: [
      { icon: LayoutTemplate, label: 'Templates', key: 'templates' },
      { icon: CloudUpload, label: 'Assets', key: 'assets' }
    ]
  };

  function onSignOut(){
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  }

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onToggle} />
      )}
      
      <div className={`
        fixed left-0 top-0 z-30 h-full bg-neutral-950 border-r border-neutral-800 
        transition-all duration-300 ease-in-out flex flex-col
        lg:relative lg:translate-x-0
        ${collapsed ? 'w-20 -translate-x-full lg:translate-x-0' : 'w-72 translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-neutral-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                <div className="h-4 w-4 rotate-45 rounded-sm bg-white" />
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">Stitcher</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-neutral-400 transition-all hover:bg-neutral-800 hover:text-white active:scale-95"
          >
            {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-4 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Search your projects"
                type="search"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          <nav className="space-y-6">
            {/* Create Section */}
            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Create
                </h3>
              )}
              {collapsed && (<div className="pt-4"></div>)}
              {menuItems.create.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onNavigate(item.key)}
                  className={`
                    flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                    transition-all duration-200 hover:bg-neutral-800 hover:text-white
                    ${activeItem === item.key
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                      : 'text-neutral-300'
                    }
                    ${collapsed ? 'justify-center px-3' : ''}
                  `}
                >
                  <item.icon size={22} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>

            {/* Billing Section */}
            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Billing
                </h3>
              )}
              {menuItems.billing.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onNavigate(item.key)}
                  className={`
                    flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                    transition-all duration-200 hover:bg-neutral-800 hover:text-white
                    ${activeItem === item.key
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                      : 'text-neutral-300'
                    }
                    ${collapsed ? 'justify-center px-3' : ''}
                  `}
                >
                  <item.icon size={22} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>

            {/* Browse Section */}
            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Browse
                </h3>
              )}
              {menuItems.browse.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onNavigate(item.key)}
                  className={`
                    flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                    transition-all duration-200 hover:bg-neutral-800 hover:text-white
                    ${activeItem === item.key
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                      : 'text-neutral-300'
                    }
                    ${collapsed ? 'justify-center px-3' : ''}
                  `}
                >
                  <item.icon size={22} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>

            {/* Settings */}
            <div className="space-y-1">
              <button 
                onClick={() => onNavigate('settings')}
                className={`
                  flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                  transition-all duration-200 hover:bg-neutral-800 hover:text-white
                  ${activeItem === 'settings'
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                    : 'text-neutral-300'
                  }
                  ${collapsed ? 'justify-center px-3' : ''}
                `}
              >
                <Settings size={22} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">Settings</span>}
              </button>
            </div>
          </nav>
        </div>

        {/* User Profile */}
        <div className="border-t border-neutral-800 p-4">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`
                flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm
                transition-colors hover:bg-neutral-800
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <div className="h-9 w-9 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-white font-medium">
                {user.username.charAt(0)}
              </div>
              {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-white truncate">{user.username}</div>
                  <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                </div>
              )}
            </button>

            {/* Dropdown */}
            {showUserMenu && !collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg z-40">
                <div className="border-b border-neutral-700 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-white font-medium">
                      {user.username.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{user.username}</div>
                      <div className="text-sm text-neutral-400 truncate">{user.email}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 p-3 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut size={18} className="flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar