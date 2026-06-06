import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Monitor,
  Users,
  LogOut,
  ChevronRight,
  FolderClosed,
  UsersRound,
  Shield,
  FileText,
  Link2,
  Settings2,
  BookOpen,
  Key,
  Bell,
  UserCog,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/address-books', label: 'Address Books', icon: BookOpen },
]

const adminNavItems = [
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
  { to: '/device-groups', label: 'Device Groups', icon: FolderClosed, adminOnly: true },
  { to: '/user-groups', label: 'User Groups', icon: UsersRound, adminOnly: true },
  { to: '/access-rules', label: 'Access Rules', icon: Shield, adminOnly: true },
  { to: '/strategies', label: 'Strategies', icon: Settings2, adminOnly: true },
  { to: '/api-tokens', label: 'API Tokens', icon: Key, adminOnly: true },
  { to: '/audit-logs', label: 'Audit Logs', icon: FileText, adminOnly: true },
  { to: '/connections', label: 'Connections', icon: Link2, adminOnly: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, adminOnly: true },
]

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function pageTitleFromPath(pathname) {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/devices') return 'Devices'
  if (pathname.startsWith('/devices/')) return 'Device Detail'
  if (pathname === '/users') return 'User Management'
  if (pathname === '/device-groups') return 'Device Groups'
  if (pathname.startsWith('/device-groups/')) return 'Device Group Detail'
  if (pathname === '/user-groups') return 'User Groups'
  if (pathname.startsWith('/user-groups/')) return 'User Group Detail'
  if (pathname === '/access-rules') return 'Access Rules'
  if (pathname === '/audit-logs') return 'Audit Logs'
  if (pathname === '/connections') return 'Connections'
  if (pathname === '/strategies') return 'Strategies'
  if (pathname.startsWith('/strategies/')) return 'Strategy Detail'
  if (pathname === '/address-books') return 'Address Books'
  if (pathname.startsWith('/address-books/')) return 'Address Book'
  if (pathname === '/api-tokens') return 'API Tokens'
  if (pathname === '/notifications') return 'Notifications'
  if (pathname === '/settings') return 'Account Settings'
  return 'Dashboard'
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const pageTitle = pageTitleFromPath(location.pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-slate-900">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            AR
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Aspendora</h1>
            <p className="text-xs text-slate-400 leading-tight">Remote Console</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          {isAdmin &&
            adminNavItems.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
        </nav>

        {/* User info + Logout */}
        <div className="border-t border-slate-700/50 px-3 py-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase">
              {user?.full_name?.[0] || user?.username?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.full_name || user?.username || 'User'}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.role || 'user'}</p>
            </div>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`
            }
          >
            <UserCog className="h-4 w-4" />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Console</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-semibold text-slate-900">{pageTitle}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
