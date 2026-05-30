import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cpu,
  DollarSign,
  FileVideo,
  MessageSquare,
  Radio,
  LogOut,
  Scissors,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { socket } from '@/lib/socket';

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, end: true },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Generation', href: '/generation', icon: Cpu },
  { label: 'Cost', href: '/cost', icon: DollarSign },
  { label: 'Content', href: '/content', icon: FileVideo },
  { label: 'Feedback', href: '/feedback', icon: MessageSquare },
  { label: 'Live', href: '/live', icon: Radio },
];

export function AppShell() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socket.disconnect();
    navigate('/login');
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Stitcher</p>
              <p className="text-xs text-muted-foreground leading-tight">Admin Portal</p>
            </div>
          </div>
        </SidebarHeader>

        <Separator />

        <SidebarContent className="px-2 py-2">
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-sidebar-primary' : '')}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="px-2 py-2">
          <Separator className="mb-2" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 shrink-0">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
