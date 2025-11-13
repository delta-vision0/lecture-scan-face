import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GraduationCap, Home, Users, BookOpen, BarChart3, Settings as SettingsIcon, LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const navigate = useNavigate();
  const { user, studentData, setStudentData } = useAuth();

  const handleSignOut = async () => {
    if (user) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error('Error signing out');
      } else {
        toast.success('Signed out successfully');
        navigate('/auth');
      }
    } else if (studentData) {
      setStudentData(null);
      toast.success('Logged out successfully');
      navigate('/auth');
    }
  };

  const goHome = () => {
    if (user) {
      navigate('/students');
    } else if (studentData) {
      navigate('/student-attendance');
    } else {
      navigate('/');
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-6 flex-1">
        {/* Logo and Home Link */}
        <Button
          variant="ghost"
          onClick={goHome}
          className="gap-2 hover:bg-muted"
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold hidden sm:inline">Face Attendance</span>
        </Button>

        {/* Teacher Navigation */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/students')}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Students
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/courses')}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Courses
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reports')}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Reports
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Button>
          </nav>
        )}

        {/* Student Navigation */}
        {studentData && (
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/student-attendance')}
              className="gap-2"
            >
              <User className="w-4 h-4" />
              Mark Attendance
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/student-dashboard')}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              My Dashboard
            </Button>
          </nav>
        )}
      </div>

      {/* Right Side - User Menu */}
      <div className="flex items-center gap-2">
        {(user || studentData) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {user ? 'Teacher' : studentData?.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                {user ? 'Teacher Account' : studentData?.roll_no}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={goHome}>
                <Home className="w-4 h-4 mr-2" />
                Home
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/students')}>
                    <Users className="w-4 h-4 mr-2" />
                    Students
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/courses')}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Courses
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/reports')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Reports
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </>
              )}
              {studentData && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/student-attendance')}>
                    <User className="w-4 h-4 mr-2" />
                    Mark Attendance
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/student-dashboard')}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    My Dashboard
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {!user && !studentData && (
          <Button onClick={() => navigate('/auth')} size="sm">
            Login
          </Button>
        )}
      </div>
    </header>
  );
};
