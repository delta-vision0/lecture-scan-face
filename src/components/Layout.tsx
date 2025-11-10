import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { GraduationCap, Users, BookOpen, Settings, LogOut, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AppSidebar = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  const menuItems = [
    { title: 'Students', url: '/students', icon: Users },
    { title: 'Courses', url: '/courses', icon: BookOpen },
    { title: 'Reports', url: '/reports', icon: BarChart3 },
    { title: 'Settings', url: '/settings', icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-6 h-6 text-sidebar-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
          <h2 className="text-sm font-semibold text-sidebar-foreground truncate">Face Attendance</h2>
          <p className="text-xs text-sidebar-foreground/60 truncate">Teacher Dashboard</p>
        </div>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent gap-3"
        >
          <LogOut className="w-5 h-5" />
          <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
        </Button>
      </div>
    </Sidebar>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <SidebarTrigger />
          </header>
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};
