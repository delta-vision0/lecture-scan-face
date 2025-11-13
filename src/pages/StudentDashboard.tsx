import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Calendar, TrendingUp, BookOpen, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Student {
  id: string;
  roll_no: string;
  name: string;
  photo_url: string | null;
}

interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
}

interface AttendanceRecord {
  id: string;
  lecture_id: string;
  marked_at: string;
  confidence: number | null;
  method: string | null;
  lecture: {
    starts_at: string;
    ends_at: string;
    room: string | null;
    course: {
      code: string;
      title: string;
    };
  };
}

interface CourseStats {
  course_id: string;
  course_code: string;
  course_title: string;
  total_lectures: number;
  attended_lectures: number;
  attendance_rate: number;
}

const StudentDashboard = () => {
  const { rollNo: rollNoParam } = useParams<{ rollNo?: string }>();
  const [rollNo, setRollNo] = useState(rollNoParam || '');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    totalLectures: 0,
    totalAttended: 0,
    overallAttendanceRate: 0,
  });

  useEffect(() => {
    if (rollNoParam) {
      setRollNo(rollNoParam);
      loadStudentData(rollNoParam);
    }
  }, [rollNoParam]);

  const loadStudentData = async (rollNumber: string) => {
    if (!rollNumber.trim()) {
      toast.error('Please enter a roll number');
      return;
    }

    setLoading(true);
    try {
      // Find student by roll number
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('roll_no', rollNumber.trim())
        .single();

      if (studentError || !studentData) {
        toast.error('Student not found. Please check your roll number.');
        setStudent(null);
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // Load enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, courses(*)')
        .eq('student_id', studentData.id);

      const courses = (enrollments || []).map((e: any) => ({
        id: e.course_id,
        code: e.courses.code,
        title: e.courses.title,
        teacher: e.courses.teacher,
      }));
      setEnrolledCourses(courses);

      // Load attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          lecture_id,
          marked_at,
          confidence,
          method,
          lectures!inner(
            starts_at,
            ends_at,
            room,
            courses!inner(code, title)
          )
        `)
        .eq('student_id', studentData.id)
        .order('marked_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const records: AttendanceRecord[] = (attendanceData || []).map((item: any) => ({
        id: item.id,
        lecture_id: item.lecture_id,
        marked_at: item.marked_at,
        confidence: item.confidence,
        method: item.method,
        lecture: {
          starts_at: item.lectures.starts_at,
          ends_at: item.lectures.ends_at,
          room: item.lectures.room,
          course: {
            code: item.lectures.courses.code,
            title: item.lectures.courses.title,
          },
        },
      }));

      setAttendanceRecords(records);

      // Calculate course statistics
      const courseStatsMap: { [key: string]: CourseStats } = {};

      courses.forEach((course) => {
        courseStatsMap[course.id] = {
          course_id: course.id,
          course_code: course.code,
          course_title: course.title,
          total_lectures: 0,
          attended_lectures: 0,
          attendance_rate: 0,
        };
      });

      // Get all lectures for enrolled courses
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length > 0) {
        const { data: lecturesData } = await supabase
          .from('lectures')
          .select('id, course_id')
          .in('course_id', courseIds);

        (lecturesData || []).forEach((lecture) => {
          if (courseStatsMap[lecture.course_id]) {
            courseStatsMap[lecture.course_id].total_lectures += 1;
          }
        });

        // Count attended lectures per course
        records.forEach((record) => {
          const courseId = courses.find(
            (c) => c.code === record.lecture.course.code
          )?.id;
          if (courseId && courseStatsMap[courseId]) {
            courseStatsMap[courseId].attended_lectures += 1;
          }
        });

        // Calculate attendance rates
        Object.values(courseStatsMap).forEach((stat) => {
          stat.attendance_rate =
            stat.total_lectures > 0
              ? (stat.attended_lectures / stat.total_lectures) * 100
              : 0;
        });

        setCourseStats(Object.values(courseStatsMap));

        // Calculate overall stats
        const totalLectures = Object.values(courseStatsMap).reduce(
          (sum, stat) => sum + stat.total_lectures,
          0
        );
        const totalAttended = records.length;

        setStats({
          totalLectures,
          totalAttended,
          overallAttendanceRate:
            totalLectures > 0 ? (totalAttended / totalLectures) * 100 : 0,
        });
      }
    } catch (error: any) {
      console.error('Error loading student data:', error);
      toast.error(error.message || 'Error loading student data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadStudentData(rollNo);
  };

  if (!student && !rollNoParam) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">Student Dashboard</CardTitle>
              <CardDescription>
                Enter your roll number to view your attendance records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roll-no">Roll Number</Label>
                <Input
                  id="roll-no"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g., CS2024001"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
              </div>
              <Button onClick={handleSearch} className="w-full" disabled={loading}>
                {loading ? 'Loading...' : 'View Dashboard'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Student Not Found</CardTitle>
              <CardDescription>
                Please check your roll number and try again
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setStudent(null)} className="w-full">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-primary"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-3xl">{student.name}</CardTitle>
                  <CardDescription className="text-lg mt-1">
                    Roll Number: {student.roll_no}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setStudent(null);
                  setRollNo('');
                }}
              >
                Search Another
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.overallAttendanceRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalAttended} of {stats.totalLectures} lectures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrolledCourses.length}</div>
              <p className="text-xs text-muted-foreground">Active courses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttended}</div>
              <p className="text-xs text-muted-foreground">Records marked</p>
            </CardContent>
          </Card>
        </div>

        {/* Course Statistics */}
        {courseStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Course-wise Attendance</CardTitle>
              <CardDescription>Your attendance breakdown by course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {courseStats.map((stat) => (
                  <div key={stat.course_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{stat.course_code}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.course_title}
                        </p>
                      </div>
                      <Badge
                        variant={
                          stat.attendance_rate >= 75
                            ? 'default'
                            : stat.attendance_rate >= 50
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {stat.attendance_rate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {stat.attended_lectures} / {stat.total_lectures} lectures
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${stat.attendance_rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Records */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance Records</CardTitle>
            <CardDescription>
              Your attendance history for all enrolled courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No attendance records found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(parseISO(record.lecture.starts_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.lecture.course.code}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.lecture.course.title}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(record.lecture.starts_at), 'HH:mm')} -{' '}
                          {format(parseISO(record.lecture.ends_at), 'HH:mm')}
                        </TableCell>
                        <TableCell>{record.lecture.room || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {record.method || 'face'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-success text-success-foreground">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Present
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  );
};

export default StudentDashboard;


