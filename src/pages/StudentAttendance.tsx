import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';

interface Lecture {
  id: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  course: {
    code: string;
    title: string;
    teacher: string;
  };
}

interface Student {
  id: string;
  roll_no: string;
  name: string;
}

const StudentAttendance = () => {
  const [rollNo, setRollNo] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLectures, setActiveLectures] = useState<Lecture[]>([]);
  const [marking, setMarking] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation(position);
          setLocationError(null);
        },
        (error) => {
          setLocationError(error.message);
          toast.error('Unable to get your location. GPS verification will not work.');
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
      toast.error('Geolocation is not supported by this browser.');
    }
  }, []);

  const handleLogin = async () => {
    if (!rollNo.trim()) {
      toast.error('Please enter your roll number');
      return;
    }

    setLoading(true);
    try {
      // Find student by roll number
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('roll_no', rollNo.trim())
        .single();

      if (studentError || !studentData) {
        toast.error('Student not found. Please check your roll number.');
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // Load active lectures for enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentData.id);

      const courseIds = (enrollments || []).map((e) => e.course_id);

      if (courseIds.length === 0) {
        toast.info('You are not enrolled in any courses.');
        setLoading(false);
        return;
      }

      // Get active lectures
      const now = new Date();
      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lectures')
        .select(`
          id,
          starts_at,
          ends_at,
          room,
          latitude,
          longitude,
          radius,
          courses!inner(code, title, teacher)
        `)
        .in('course_id', courseIds)
        .gte('ends_at', now.toISOString())
        .order('starts_at', { ascending: true });

      if (lecturesError) throw lecturesError;

      // Filter to only truly active lectures (between start and end time)
      const active = (lecturesData || [])
        .map((item: any) => ({
          id: item.id,
          starts_at: item.starts_at,
          ends_at: item.ends_at,
          room: item.room,
          latitude: item.latitude,
          longitude: item.longitude,
          radius: item.radius,
          course: {
            code: item.courses.code,
            title: item.courses.title,
            teacher: item.courses.teacher,
          },
        }))
        .filter((lecture) =>
          isWithinInterval(now, {
            start: parseISO(lecture.starts_at),
            end: parseISO(lecture.ends_at),
          })
        );

      setActiveLectures(active);

      if (active.length === 0) {
        toast.info('No active lectures at the moment.');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const markAttendance = async (lecture: Lecture) => {
    if (!student) return;

    // Check if GPS location is required and available
    if (lecture.latitude && lecture.longitude) {
      if (!userLocation) {
        toast.error('GPS location is required but not available.');
        return;
      }

      const distance = calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        lecture.latitude,
        lecture.longitude
      );

      const allowedRadius = lecture.radius || 100;

      if (distance > allowedRadius) {
        toast.error(
          `You are too far from the lecture location (${Math.round(distance)}m away). You must be within ${allowedRadius}m.`
        );
        return;
      }
    }

    setMarking(lecture.id);

    try {
      // Check if already marked
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('lecture_id', lecture.id)
        .eq('student_id', student.id)
        .single();

      if (existing) {
        toast.info('You have already marked attendance for this lecture.');
        setMarking(null);
        return;
      }

      // Mark attendance
      const { error } = await supabase.from('attendance').insert({
        lecture_id: lecture.id,
        student_id: student.id,
        method: 'gps',
        marked_at: new Date().toISOString(),
        confidence: userLocation ? 1.0 : null,
      });

      if (error) throw error;

      toast.success('Attendance marked successfully!');
      
      // Remove the lecture from active lectures
      setActiveLectures((prev) => prev.filter((l) => l.id !== lecture.id));
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast.error(error.message || 'Error marking attendance');
    } finally {
      setMarking(null);
    }
  };

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Mark Your Attendance</CardTitle>
            <CardDescription>
              Enter your roll number to mark attendance for active lectures
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {locationError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <p className="font-medium">GPS Warning:</p>
                <p>{locationError}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="roll-no">Roll Number</Label>
              <Input
                id="roll-no"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g., CS2024001"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
              />
            </div>
            <Button onClick={handleLogin} className="w-full" disabled={loading}>
              {loading ? 'Loading...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="container mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Welcome, {student.name}</CardTitle>
                <CardDescription>Roll Number: {student.roll_no}</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setStudent(null);
                  setRollNo('');
                  setActiveLectures([]);
                }}
              >
                Logout
              </Button>
            </div>
          </CardHeader>
        </Card>

        {userLocation && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">
                  GPS Location: {userLocation.coords.latitude.toFixed(6)},{' '}
                  {userLocation.coords.longitude.toFixed(6)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Active Lectures</CardTitle>
            <CardDescription>
              Mark your attendance for ongoing lectures
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeLectures.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active lectures at the moment</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check back when your lecture is scheduled
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeLectures.map((lecture) => (
                  <Card key={lecture.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-lg">
                                {lecture.course.code} - {lecture.course.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {lecture.course.teacher}
                              </p>
                            </div>
                            <Badge variant="default" className="bg-success text-success-foreground">
                              Live
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Time</p>
                            <p className="font-medium">
                              {format(parseISO(lecture.starts_at), 'p')} -{' '}
                              {format(parseISO(lecture.ends_at), 'p')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Room</p>
                            <p className="font-medium">{lecture.room || 'Not specified'}</p>
                          </div>
                        </div>

                        {lecture.latitude && lecture.longitude && (
                          <div className="p-3 rounded-lg bg-muted/50 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>GPS verification required (within {lecture.radius || 100}m)</span>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={() => markAttendance(lecture)}
                          disabled={!!marking}
                          className="w-full"
                        >
                          {marking === lecture.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Marking...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Mark Attendance
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentAttendance;
