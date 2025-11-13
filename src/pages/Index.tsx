import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { GraduationCap, UserCheck } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 mt-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Attendance Management System
          </h1>
          <p className="text-xl text-muted-foreground">
            Modern face recognition and GPS-based attendance tracking
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Teacher Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Teacher Portal</CardTitle>
                  <CardDescription>Manage courses and attendance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create courses, schedule lectures, manage enrollments, and track attendance using face recognition or manual marking.
              </p>
              <Link to="/auth">
                <Button className="w-full">
                  Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Student Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <UserCheck className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Student Portal</CardTitle>
                  <CardDescription>Mark attendance & view records</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Login with your roll number to mark attendance for active lectures using face recognition and view your attendance records.
              </p>
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  Login as Student
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium">Face Recognition</p>
                  <p className="text-muted-foreground">Automated attendance marking</p>
                </div>
                <div>
                  <p className="font-medium">GPS Verification</p>
                  <p className="text-muted-foreground">Location-based attendance</p>
                </div>
                <div>
                  <p className="font-medium">Manual Override</p>
                  <p className="text-muted-foreground">Teacher-controlled marking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
  );
};

export default Index;
