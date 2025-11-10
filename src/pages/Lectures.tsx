import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, ExternalLink, Calendar, ArrowLeft, UserCheck, MapPin } from 'lucide-react';
import { format, addMinutes } from 'date-fns';

interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
}

interface Lecture {
  id: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  attendance_count?: number;
  attendance_enabled: boolean;
}

interface Student {
  id: string;
  roll_no: string;
  name: string;
  enrolled: boolean;
}

const Lectures = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [room, setRoom] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [saving, setSaving] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);
  const [lectureAttendance, setLectureAttendance] = useState<{ [studentId: string]: boolean }>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourse();
      fetchLectures();
      fetchStudents();
    }
  }, [courseId]);

  const fetchCourse = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) {
      toast.error('Error fetching course');
      navigate('/courses');
    } else {
      setCourse(data);
    }
  };

  const fetchLectures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lectures')
      .select('id, starts_at, ends_at, room, attendance_enabled')
      .eq('course_id', courseId)
      .order('starts_at', { ascending: false });

    if (error) {
      toast.error('Error fetching lectures');
      setLoading(false);
      return;
    }

    const lecturesWithCounts = await Promise.all(
      (data || []).map(async (lecture) => {
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('lecture_id', lecture.id);

        return { ...lecture, attendance_count: count || 0 };
      })
    );

    setLectures(lecturesWithCounts);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .order('roll_no');

    if (studentsError) {
      toast.error('Error fetching students');
      return;
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', courseId);

    if (enrollError) {
      toast.error('Error fetching enrollments');
      return;
    }

    const enrolledIds = new Set(enrollments?.map((e) => e.student_id) || []);

    const studentsWithEnrollment = (allStudents || []).map((student) => ({
      ...student,
      enrolled: enrolledIds.has(student.id),
    }));

    setStudents(studentsWithEnrollment);
  };

  const toggleLectureAttendance = async (lectureId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('lectures')
        .update({ attendance_enabled: !currentStatus })
        .eq('id', lectureId);

      if (error) throw error;

      toast.success(`Attendance ${!currentStatus ? 'enabled' : 'disabled'} for lecture`);
      fetchLectures();
    } catch (error: any) {
      toast.error(error.message || 'Error updating attendance status');
    }
  };

  const handleCreateLecture = async () => {
    if (!startsAt) {
      toast.error('Please select a start time');
      return;
    }

    // Validate GPS coordinates if provided
    if ((latitude || longitude) && !(latitude && longitude)) {
      toast.error('Please provide both latitude and longitude');
      return;
    }

    setSaving(true);

    try {
      const startsAtDate = new Date(startsAt);
      const endsAtDate = addMinutes(startsAtDate, duration);

      const lectureData: any = {
        course_id: courseId,
        starts_at: startsAtDate.toISOString(),
        ends_at: endsAtDate.toISOString(),
        room: room || null,
      };

      // Add GPS data if provided
      if (latitude && longitude) {
        lectureData.latitude = parseFloat(latitude);
        lectureData.longitude = parseFloat(longitude);
        lectureData.radius = parseFloat(radius) || 100;
      }

      const { error } = await supabase.from('lectures').insert(lectureData);

      if (error) throw error;

      toast.success('Lecture created successfully!');
      fetchLectures();
      setDialogOpen(false);
      setStartsAt('');
      setRoom('');
      setLatitude('');
      setLongitude('');
      setRadius('100');
      setDuration(60);
    } catch (error: any) {
      toast.error(error.message || 'Error creating lecture');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnrollment = async (studentId: string, enrolled: boolean) => {
    try {
      if (enrolled) {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('student_id', studentId)
          .eq('course_id', courseId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enrollments')
          .insert({
            student_id: studentId,
            course_id: courseId,
          });

        if (error) throw error;
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, enrolled: !enrolled } : s))
      );

      toast.success(enrolled ? 'Student unenrolled' : 'Student enrolled');
    } catch (error: any) {
      toast.error(error.message || 'Error updating enrollment');
    }
  };

  const openKiosk = (lectureId: string) => {
    window.open(`/kiosk/${lectureId}`, '_blank');
  };

  const openAttendanceDialog = async (lectureId: string) => {
    setSelectedLectureId(lectureId);
    setAttendanceDialogOpen(true);
    await fetchLectureAttendance(lectureId);
  };

  const fetchLectureAttendance = async (lectureId: string) => {
    setLoadingAttendance(true);
    try {
      // Get enrolled students
      const enrolledStudents = students.filter(s => s.enrolled);
      
      // Get existing attendance
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('lecture_id', lectureId);

      if (error) throw error;

      const markedStudentIds = new Set((attendance || []).map(a => a.student_id));
      const attendanceMap: { [studentId: string]: boolean } = {};
      
      enrolledStudents.forEach(student => {
        attendanceMap[student.id] = markedStudentIds.has(student.id);
      });

      setLectureAttendance(attendanceMap);
    } catch (error: any) {
      toast.error(error.message || 'Error fetching attendance');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const toggleAttendance = async (studentId: string, isPresent: boolean) => {
    if (!selectedLectureId) return;

    try {
      if (isPresent) {
        // Remove attendance
        const { error } = await supabase
          .from('attendance')
          .delete()
          .eq('lecture_id', selectedLectureId)
          .eq('student_id', studentId);

        if (error) throw error;
        toast.success('Attendance removed');
      } else {
        // Add attendance
        const { error } = await supabase
          .from('attendance')
          .insert({
            lecture_id: selectedLectureId,
            student_id: studentId,
            method: 'manual',
            marked_at: new Date().toISOString(),
          });

        if (error) throw error;
        toast.success('Attendance marked');
      }

      // Update local state
      setLectureAttendance(prev => ({
        ...prev,
        [studentId]: !isPresent,
      }));

      // Refresh lecture list
      fetchLectures();
    } catch (error: any) {
      toast.error(error.message || 'Error updating attendance');
    }
  };

  if (!course) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/courses')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <Badge variant="secondary" className="mb-2">{course.code}</Badge>
            <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
            <p className="text-muted-foreground mt-1">{course.teacher}</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Manage Enrollments</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Manage Enrollments</DialogTitle>
                  <DialogDescription>
                    Select which students are enrolled in this course
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-4">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={student.enrolled}
                        onCheckedChange={() =>
                          toggleEnrollment(student.id, student.enrolled)
                        }
                      />
                      <div className="flex-1">
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.roll_no}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Start Lecture
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Lecture</DialogTitle>
                  <DialogDescription>
                    Create a lecture and open the kiosk for automatic attendance
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="starts-at">Start Time</Label>
                    <Input
                      id="starts-at"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      min={15}
                      max={180}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">Room (optional)</Label>
                    <Input
                      id="room"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="e.g., Room 301"
                    />
                  </div>
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <Label className="text-sm font-medium">GPS Location (Optional)</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set GPS coordinates to enable location-based student attendance
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          placeholder="e.g., 40.7128"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longitude" className="text-xs">Longitude</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          placeholder="e.g., -74.0060"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radius" className="text-xs">Allowed Radius (meters)</Label>
                      <Input
                        id="radius"
                        type="number"
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateLecture}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? 'Creating...' : 'Start Lecture'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lectures</CardTitle>
            <CardDescription>Total: {lectures.length} lectures</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : lectures.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No lectures yet. Click "Start Lecture" to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lectures.map((lecture) => {
                    const starts = new Date(lecture.starts_at);
                    const ends = new Date(lecture.ends_at);
                    const durationMin = Math.round(
                      (ends.getTime() - starts.getTime()) / 60000
                    );
                    const isActive =
                      new Date() >= starts && new Date() <= ends;

                    return (
                      <TableRow key={lecture.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {format(starts, 'PPP')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(starts, 'p')} - {format(ends, 'p')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{durationMin} min</TableCell>
                        <TableCell>{lecture.room || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {lecture.attendance_count}
                            </span>
                            {isActive && (
                              <Badge
                                variant="default"
                                className="bg-success text-success-foreground"
                              >
                                Live
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={lecture.attendance_enabled ? "default" : "outline"}
                            onClick={() => toggleLectureAttendance(lecture.id, lecture.attendance_enabled)}
                          >
                            {lecture.attendance_enabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAttendanceDialog(lecture.id)}
                              className="gap-2"
                            >
                              <UserCheck className="w-4 h-4" />
                              Manage
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openKiosk(lecture.id)}
                              className="gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Kiosk
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Manual Attendance Dialog */}
        <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Attendance</DialogTitle>
              <DialogDescription>
                Manually mark or unmark student attendance for this lecture
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {loadingAttendance ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : (
                students.filter(s => s.enrolled).map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={lectureAttendance[student.id] || false}
                      onCheckedChange={() =>
                        toggleAttendance(student.id, lectureAttendance[student.id] || false)
                      }
                    />
                    <div className="flex-1">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.roll_no}
                      </p>
                    </div>
                    {lectureAttendance[student.id] && (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        <UserCheck className="w-3 h-3 mr-1" />
                        Present
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Lectures;
