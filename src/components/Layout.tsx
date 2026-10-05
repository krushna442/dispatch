import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ClipboardList, ScanLine, Truck,
  Users, BarChart3, LogOut, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    const role = user?.role;
    if (role === 'operator') {
      return [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/scan', label: 'Scan Part', icon: ScanLine },
        { to: '/gatepass', label: 'Gate Pass', icon: Truck },
      ];
    }
    if (role === 'sales') {
      return [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/plans', label: 'Dispatch Plan', icon: ClipboardList },
        { to: '/scan', label: 'Scan Part', icon: ScanLine },
        { to: '/gatepass', label: 'Gate Pass', icon: Truck },
      ];
    }
    // Admin has full access
    return [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/plans', label: 'Dispatch Plan', icon: ClipboardList },
      { to: '/scan', label: 'Scan Part', icon: ScanLine },
      { to: '/gatepass', label: 'Gate Pass', icon: Truck },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/users', label: 'Users', icon: Users },
    ];
  };

  const links = getNavLinks();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 ${
          sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-2.5 sm:p-3 border-b border-slate-800 relative flex items-center justify-center">
          <NavLink
            to="/"
            className="w-full bg-white rounded-xl py-2 px-2.5 shadow-md flex items-center justify-center hover:bg-slate-50 transition-all overflow-hidden"
            title="RSB Dispatch Management System"
          >
            {sidebarCollapsed ? (
              <img
                src="/logo-small.png"
                alt="RSB Logo"
                className="h-8 sm:h-9 w-auto max-w-[48px] object-contain transition-all duration-300"
              />
            ) : (
              <img
                src="/logo.png"
                alt="RSB Logo"
                className="w-full h-10 sm:h-11 object-contain transition-all duration-300"
              />
            )}
          </NavLink>

          {/* Desktop collapse toggle button - floating on the border */}
          {/* <button
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-400 hover:text-white items-center justify-center shadow-lg transition-all z-30 cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button> */}

          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute right-3.5 top-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center ${
                  sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } rounded-xl text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {sidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-slate-700 font-medium">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section & collapse toggle footer */}
        <div className="border-t border-slate-800 p-3">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div
              className="w-9 h-9 rounded-full bg-slate-800 border border-teal-500/30 flex items-center justify-center text-sm font-bold text-teal-400 shrink-0"
              title={`${user?.name} (${user?.role})`}
            >
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle option at bottom */}
          <button
            onClick={toggleSidebarCollapse}
            className={`hidden lg:flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'justify-between'
            } w-full mt-2.5 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors text-xs font-medium`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-teal-400" />
            ) : (
              <>
                <span className="text-slate-400 text-[11px]">Collapse Sidebar</span>
                <ChevronLeft className="w-4 h-4 text-teal-400" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar / Nav */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="bg-white/95 p-1 rounded-lg flex items-center justify-center">
                <img src="/logo-small.png" alt="RSB Logo" className="h-5 w-auto object-contain" />
              </div>
            </div>
          </div>

          {/* Right corner of nav: Customer, Vendor, User Role Badge, and Logout Button */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {user?.customer_name && (
              <span className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[110px] sm:max-w-[200px]">
                Customer: <span className="text-teal-400 font-medium">{user.customer_name}</span>
              </span>
            )}
            {user?.vendor_code && (
              <span className="px-2 py-0.5 sm:py-1 rounded-md bg-slate-800 text-[11px] sm:text-xs text-slate-300 font-mono shrink-0 border border-slate-700/60">
                {user.vendor_code}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
              {user?.role}
            </span>

            {/* Logout button at the right corner beside user role badge */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 border border-slate-700/80 hover:border-red-500/30 transition-all shrink-0 cursor-pointer shadow-sm ml-1"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
