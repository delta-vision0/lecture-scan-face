import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, MapPin, User, Clock, Camera } from 'lucide-react';
import { format } from 'date-fns';

interface Lecture {
  id: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  courses: {
    code: string;
    title: string;
  };
}

interface AttendanceRecord {
  id: string;
  marked_at: string;
  method: string | null;
  confidence: number | null;
  photo_url: string | null;
  students: {
    roll_no: string;
    name: string;
    photo_url: string | null;
  };
}

const AttendanceDetails = () => {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (lectureId) {
      fetchLectureDetails();
    }
  }, [lectureId]);

  const fetchLectureDetails = async () => {
    setLoading(true);
    try {
      // Fetch lecture details
      const { data: lectureData, error: lectureError } = await supabase
        .from('lectures')
        .select(`
          id,
          starts_at,
          ends_at,
          room,
          latitude,
          longitude,
          radius,
          courses!inner(code, title)
        `)
        .eq('id', lectureId)
        .single();

      if (lectureError) throw lectureError;
      setLecture(lectureData);

      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          marked_at,
          method,
          confidence,
          photo_url,
          students!inner(roll_no, name, photo_url)
        `)
        .eq('lecture_id', lectureId)
        .order('marked_at', { ascending: false });

      if (attendanceError) throw attendanceError;
      setAttendance(attendanceData || []);
    } catch (error: any) {
      toast.error(error.message || 'Error fetching attendance details');
      navigate('/courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !lecture) {
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
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Lecture Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary" className="mb-2">{lecture.courses.code}</Badge>
                <CardTitle className="text-2xl">{lecture.courses.title}</CardTitle>
                <CardDescription className="mt-2">
                  Attendance Details for Lecture
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{format(new Date(lecture.starts_at), 'PPP')}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(lecture.starts_at), 'p')} - {format(new Date(lecture.ends_at), 'p')}
                  </p>
                </div>
              </div>
              {lecture.room && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Room</p>
                    <p className="text-muted-foreground">{lecture.room}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Total Present</p>
                  <p className="text-muted-foreground">{attendance.length} students</p>
                </div>
              </div>
            </div>
            {lecture.latitude && lecture.longitude && (
              <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">GPS Location Required</p>
                  <p className="text-muted-foreground">
                    Lat: {lecture.latitude}, Lng: {lecture.longitude} (Radius: {lecture.radius}m)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              Detailed view of all students who marked attendance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No attendance records yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Roll Number</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Selfie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {record.students.photo_url ? (
                              <img
                                src={record.students.photo_url}
                                alt={record.students.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-4 h-4" />
                              </div>
                            )}
                            <span className="font-medium">{record.students.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{record.students.roll_no}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(record.marked_at), 'PPp')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.method === 'face' ? 'default' : 'secondary'}>
                            {record.method || 'face'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.confidence ? (
                            <span className="text-sm">{(record.confidence * 100).toFixed(1)}%</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.photo_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPhoto(record.photo_url)}
                              className="gap-2"
                            >
                              <Camera className="w-4 h-4" />
                              View
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selfie Preview Dialog */}
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Attendance Selfie</DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="flex justify-center">
                <img
                  src={selectedPhoto}
                  alt="Attendance selfie"
                  className="max-w-full max-h-[70vh] rounded-lg object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AttendanceDetails;
