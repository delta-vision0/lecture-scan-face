import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'teacher' | 'student'>('teacher');
  const navigate = useNavigate();
  const { user, studentData, setStudentData } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/students');
    } else if (studentData) {
      navigate('/student-attendance');
    }
  }, [user, studentData, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Account created successfully! You can now sign in.');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed in successfully!');
      navigate('/students');
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('id, roll_no, name')
        .eq('roll_no', rollNo.trim())
        .single();

      if (error || !student) {
        toast.error('Student not found. Please check your roll number.');
        setLoading(false);
        return;
      }

      setStudentData(student);
      toast.success(`Welcome ${student.name}!`);
      navigate('/student-attendance');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-strong">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-medium">
            <GraduationCap className="w-10 h-10 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Face Attendance</CardTitle>
            <CardDescription className="text-base mt-2">
              Automated attendance tracking with face recognition
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Login Type Selection */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={loginType === 'teacher' ? 'default' : 'ghost'}
                onClick={() => setLoginType('teacher')}
                className="w-full"
              >
                Teacher
              </Button>
              <Button
                type="button"
                variant={loginType === 'student' ? 'default' : 'ghost'}
                onClick={() => setLoginType('student')}
                className="w-full"
              >
                Student
              </Button>
            </div>

            {/* Teacher Login */}
            {loginType === 'teacher' && (
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="teacher@college.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="teacher@college.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creating account...' : 'Sign Up'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {/* Student Login */}
            {loginType === 'student' && (
              <form onSubmit={handleStudentLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="student-roll">Roll Number / PRN</Label>
                  <Input
                    id="student-roll"
                    type="text"
                    placeholder="e.g., CS2024001"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login as Student'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Your roll number is your student ID assigned by your teacher
                </p>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
