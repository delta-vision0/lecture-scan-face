import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, BarChart3, TrendingUp, Users, Calendar } from 'lucide-react';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_roll_no: string;
  lecture_id: string;
  lecture_date: string;
  course_code: string;
  course_title: string;
  marked_at: string;
  confidence: number | null;
  method: string | null;
}

interface CourseStats {
  course_id: string;
  course_code: string;
  course_title: string;
  total_lectures: number;
  total_attendance: number;
  avg_attendance_rate: number;
}

const Reports = () => {
  const [courses, setCourses] = useState<{ id: string; code: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (courses.length > 0) {
      fetchAttendanceData();
      fetchCourseStats();
    }
  }, [selectedCourse, dateRange, courses]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, code, title')
      .order('code');

    if (error) {
      toast.error('Error fetching courses');
      return;
    }

    setCourses(data || []);
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const dateFilter = dateRange === 'all' 
        ? undefined 
        : subDays(new Date(), parseInt(dateRange));

      let query = supabase
        .from('attendance')
        .select(`
          id,
          student_id,
          marked_at,
          confidence,
          method,
          lecture_id,
          students!inner(name, roll_no),
          lectures!inner(
            starts_at,
            course_id,
            courses!inner(code, title)
          )
        `)
        .order('marked_at', { ascending: false });

      if (selectedCourse !== 'all') {
        query = query.eq('lectures.course_id', selectedCourse);
      }

      if (dateFilter) {
        query = query.gte('marked_at', dateFilter.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const records: AttendanceRecord[] = (data || []).map((item: any) => ({
        id: item.id,
        student_id: item.student_id,
        student_name: item.students.name,
        student_roll_no: item.students.roll_no,
        lecture_id: item.lecture_id,
        lecture_date: item.lectures.starts_at,
        course_code: item.lectures.courses.code,
        course_title: item.lectures.courses.title,
        marked_at: item.marked_at,
        confidence: item.confidence,
        method: item.method,
      }));

      setAttendanceRecords(records);

      // Prepare chart data
      const dailyData: { [key: string]: number } = {};
      records.forEach(record => {
        const date = format(parseISO(record.marked_at), 'yyyy-MM-dd');
        dailyData[date] = (dailyData[date] || 0) + 1;
      });

      const chartDataArray = Object.entries(dailyData)
        .map(([date, count]) => ({
          date: format(parseISO(date), 'MMM dd'),
          attendance: count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setChartData(chartDataArray);
    } catch (error: any) {
      toast.error(error.message || 'Error fetching attendance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseStats = async () => {
    try {
      const dateFilter = dateRange === 'all' 
        ? undefined 
        : subDays(new Date(), parseInt(dateRange));

      let lecturesQuery = supabase
        .from('lectures')
        .select('id, course_id, starts_at, courses!inner(code, title)');

      if (selectedCourse !== 'all') {
        lecturesQuery = lecturesQuery.eq('course_id', selectedCourse);
      }

      if (dateFilter) {
        lecturesQuery = lecturesQuery.gte('starts_at', dateFilter.toISOString());
      }

      const { data: lectures, error: lecturesError } = await lecturesQuery;

      if (lecturesError) throw lecturesError;

      const statsMap: { [key: string]: CourseStats } = {};

      (lectures || []).forEach((lecture: any) => {
        const courseId = lecture.course_id;
        if (!statsMap[courseId]) {
          statsMap[courseId] = {
            course_id: courseId,
            course_code: lecture.courses.code,
            course_title: lecture.courses.title,
            total_lectures: 0,
            total_attendance: 0,
            avg_attendance_rate: 0,
          };
        }
        statsMap[courseId].total_lectures += 1;
      });

      // Get attendance counts per course
      const lectureIds = (lectures || []).map((l: any) => l.id);
      
      if (lectureIds.length > 0) {
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('lecture_id')
          .in('lecture_id', lectureIds);

        if (!attendanceError && attendance) {
          attendance.forEach((a) => {
            const lecture = lectures?.find((l: any) => l.id === a.lecture_id);
            if (lecture) {
              const courseId = lecture.course_id;
              if (statsMap[courseId]) {
                statsMap[courseId].total_attendance += 1;
              }
            }
          });
        }
      }

      // Calculate average attendance rate
      Object.values(statsMap).forEach(stat => {
        // Get enrolled students count for each course
        supabase
          .from('enrollments')
          .select('student_id', { count: 'exact', head: false })
          .eq('course_id', stat.course_id)
          .then(({ count }) => {
            const enrolledCount = count || 0;
            stat.avg_attendance_rate = enrolledCount > 0 
              ? (stat.total_attendance / (stat.total_lectures * enrolledCount)) * 100 
              : 0;
          });
      });

      setCourseStats(Object.values(statsMap));
    } catch (error: any) {
      console.error('Error fetching course stats:', error);
    }
  };

  const exportToCSV = () => {
    if (attendanceRecords.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Course Code', 'Course Title', 'Student Roll No', 'Student Name', 'Marked At', 'Confidence', 'Method'];
    const rows = attendanceRecords.map(record => [
      format(parseISO(record.lecture_date), 'yyyy-MM-dd'),
      record.course_code,
      record.course_title,
      record.student_roll_no,
      record.student_name,
      format(parseISO(record.marked_at), 'yyyy-MM-dd HH:mm:ss'),
      record.confidence?.toFixed(2) || 'N/A',
      record.method || 'face',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exported successfully');
  };

  const totalAttendance = attendanceRecords.length;
  const uniqueStudents = new Set(attendanceRecords.map(r => r.student_id)).size;
  const avgConfidence = attendanceRecords
    .filter(r => r.confidence !== null)
    .reduce((sum, r) => sum + (r.confidence || 0), 0) / 
    attendanceRecords.filter(r => r.confidence !== null).length || 0;

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-8 h-8" />
              Attendance Reports
            </h1>
            <p className="text-muted-foreground mt-1">View and analyze attendance data</p>
          </div>
          <Button onClick={exportToCSV} className="gap-2" disabled={attendanceRecords.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAttendance}</div>
              <p className="text-xs text-muted-foreground">Records in period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueStudents}</div>
              <p className="text-xs text-muted-foreground">Students attended</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgConfidence.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Face recognition accuracy</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseStats.length}</div>
              <p className="text-xs text-muted-foreground">Active courses</p>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>Daily attendance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {courseStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Course Statistics</CardTitle>
              <CardDescription>Attendance by course</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courseStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="course_code" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_attendance" fill="#3b82f6" name="Total Attendance" />
                  <Bar dataKey="total_lectures" fill="#10b981" name="Total Lectures" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>Detailed attendance log</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : attendanceRecords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No attendance records found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Marked At</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(parseISO(record.lecture_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.course_code}</p>
                            <p className="text-sm text-muted-foreground">{record.course_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.student_name}</TableCell>
                        <TableCell>{record.student_roll_no}</TableCell>
                        <TableCell>{format(parseISO(record.marked_at), 'HH:mm:ss')}</TableCell>
                        <TableCell>
                          {record.confidence !== null ? (
                            <Badge variant={record.confidence > 0.45 ? 'default' : 'secondary'}>
                              {(record.confidence * 100).toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.method || 'face'}</Badge>
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
    </Layout>
  );
};

export default Reports;

