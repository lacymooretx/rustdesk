import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Users from './pages/Users'
import DeviceGroups from './pages/DeviceGroups'
import DeviceGroupDetail from './pages/DeviceGroupDetail'
import UserGroups from './pages/UserGroups'
import UserGroupDetail from './pages/UserGroupDetail'
import AccessRules from './pages/AccessRules'
import Strategies from './pages/Strategies'
import StrategyDetail from './pages/StrategyDetail'
import AddressBooks from './pages/AddressBooks'
import AddressBookDetail from './pages/AddressBookDetail'
import AuditLogs from './pages/AuditLogs'
import Connections from './pages/Connections'
import APITokens from './pages/APITokens'
import SSOCallback from './pages/SSOCallback'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Downloads from './pages/Downloads'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sso-callback" element={<SSOCallback />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-groups"
          element={
            <ProtectedRoute adminOnly>
              <DeviceGroups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-groups/:id"
          element={
            <ProtectedRoute adminOnly>
              <DeviceGroupDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-groups"
          element={
            <ProtectedRoute adminOnly>
              <UserGroups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-groups/:id"
          element={
            <ProtectedRoute adminOnly>
              <UserGroupDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/access-rules"
          element={
            <ProtectedRoute adminOnly>
              <AccessRules />
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategies"
          element={
            <ProtectedRoute adminOnly>
              <Strategies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategies/:id"
          element={
            <ProtectedRoute adminOnly>
              <StrategyDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/address-books"
          element={
            <ProtectedRoute>
              <AddressBooks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/address-books/:id"
          element={
            <ProtectedRoute>
              <AddressBookDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-tokens"
          element={
            <ProtectedRoute adminOnly>
              <APITokens />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute adminOnly>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute adminOnly>
              <Connections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute adminOnly>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
