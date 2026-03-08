import Sidebar from '../../components/layout/Sidebar'
import SocketProvider from '../../components/SocketProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Socket.io + Web Push + toasts — solo en páginas autenticadas */}
      <SocketProvider />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
