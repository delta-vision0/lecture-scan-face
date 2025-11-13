import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { toast } from 'sonner';
import { Camera, MapPin, User, Loader2 } from 'lucide-react';
import { loadFaceModels } from '@/lib/face/models';
import { getEmbeddingFromVideo } from '@/lib/face/embedding';
import { format } from 'date-fns';

interface Lecture {
  id: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  attendance_enabled: boolean;
  course: {
    code: string;
    title: string;
    teacher: string;
  };
}

const StudentAttendance = () => {
  const navigate = useNavigate();
  const { studentData, setStudentData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeLectures, setActiveLectures] = useState<Lecture[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!studentData) {
      navigate('/auth');
      return;
    }

    loadModels();
    getUserLocation();
    fetchActiveLectures();

    const interval = setInterval(fetchActiveLectures, 30000);
    return () => clearInterval(interval);
  }, [studentData]);

  const loadModels = async () => {
    try {
      await loadFaceModels();
      setModelsLoaded(true);
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load face recognition models');
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
        toast.error('Unable to get your location. Please enable location services.');
      }
    );
  };

  const fetchActiveLectures = async () => {
    if (!studentData) return;

    try {
      const now = new Date().toISOString();

      // Get enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentData.id);

      if (!enrollments || enrollments.length === 0) {
        setActiveLectures([]);
        return;
      }

      const courseIds = enrollments.map((e) => e.course_id);

      // Get active lectures
      const { data: lectures, error } = await supabase
        .from('lectures')
        .select(`
          id,
          starts_at,
          ends_at,
          room,
          latitude,
          longitude,
          radius,
          attendance_enabled,
          courses!inner(code, title, teacher)
        `)
        .in('course_id', courseIds)
        .lte('starts_at', now)
        .gte('ends_at', now);

      if (error) throw error;

      const formattedLectures: Lecture[] = (lectures || []).map((l: any) => ({
        id: l.id,
        starts_at: l.starts_at,
        ends_at: l.ends_at,
        room: l.room,
        latitude: l.latitude,
        longitude: l.longitude,
        radius: l.radius,
        attendance_enabled: l.attendance_enabled || false,
        course: {
          code: l.courses.code,
          title: l.courses.title,
          teacher: l.courses.teacher,
        },
      }));

      setActiveLectures(formattedLectures);
    } catch (error: any) {
      console.error('Error fetching lectures:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const startCamera = async (lecture: Lecture) => {
    if (!modelsLoaded) {
      toast.error('Face recognition models are still loading');
      return;
    }

    // Check location if required
    if (lecture.latitude && lecture.longitude && lecture.radius) {
      if (!userLocation) {
        toast.error('Unable to verify location. Please enable location services.');
        return;
      }

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        lecture.latitude,
        lecture.longitude
      );

      if (distance > lecture.radius) {
        toast.error(`You are ${Math.round(distance)}m away. Must be within ${lecture.radius}m of the lecture location.`);
        return;
      }
    }

    setSelectedLecture(lecture);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setSelectedLecture(null);
  };

  const captureAndMarkAttendance = async () => {
    if (!videoRef.current || !selectedLecture || !studentData) return;

    setLoading(true);

    try {
      // Get face embedding from video
      const result = await getEmbeddingFromVideo(videoRef.current);

      if (!result) {
        toast.error('No face detected. Please ensure your face is clearly visible.');
        setLoading(false);
        return;
      }

      // Capture selfie from video
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
      }

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85);
      });

      // Get student's stored embedding
      const { data: student } = await supabase
        .from('students')
        .select('embedding')
        .eq('id', studentData.id)
        .single();

      if (!student?.embedding) {
        toast.error('No face profile found. Please contact your teacher.');
        setLoading(false);
        return;
      }

      // Calculate similarity
      const storedEmbedding = student.embedding;
      const capturedEmbedding = Array.from(result.descriptor);

      let distance = 0;
      for (let i = 0; i < storedEmbedding.length; i++) {
        distance += Math.pow(storedEmbedding[i] - capturedEmbedding[i], 2);
      }
      distance = Math.sqrt(distance);

      const confidence = Math.max(0, 1 - distance);

      if (confidence < 0.6) {
        toast.error('Face does not match. Please try again.');
        setLoading(false);
        return;
      }

      // Check if already marked
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('lecture_id', selectedLecture.id)
        .eq('student_id', studentData.id)
        .single();

      if (existingAttendance) {
        toast.info('Attendance already marked for this lecture');
        stopCamera();
        setLoading(false);
        return;
      }

      // Upload selfie to storage
      const fileName = `attendance-${selectedLecture.id}-${studentData.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('faces')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload selfie');
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('faces')
        .getPublicUrl(fileName);

      // Mark attendance with selfie
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          lecture_id: selectedLecture.id,
          student_id: studentData.id,
          confidence: confidence,
          method: 'face',
          photo_url: publicUrl,
        });

      if (attendanceError) throw attendanceError;

      toast.success(`Attendance marked successfully! Confidence: ${(confidence * 100).toFixed(1)}%`);
      stopCamera();
      fetchActiveLectures();
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setStudentData(null);
    navigate('/auth');
  };

  if (!studentData) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="container mx-auto max-w-4xl space-y-6">
          {/* Student Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{studentData.name}</CardTitle>
                  <CardDescription>Roll No: {studentData.roll_no}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

        {/* Location Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {userLocation ? (
                <p className="text-sm">
                  Location detected: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {locationError || 'Detecting location...'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Camera View */}
        {cameraActive && selectedLecture && (
          <Card>
            <CardHeader>
              <CardTitle>Capture Face for Attendance</CardTitle>
              <CardDescription>
                {selectedLecture.course.code} - {selectedLecture.course.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={captureAndMarkAttendance} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Capture & Mark Attendance
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Lectures */}
        <Card>
          <CardHeader>
            <CardTitle>Active Lectures</CardTitle>
            <CardDescription>
              Lectures available for attendance marking right now
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeLectures.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No active lectures at the moment
              </p>
            ) : (
              <div className="space-y-4">
                {activeLectures.map((lecture) => (
                  <Card key={lecture.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div>
                            <h3 className="font-semibold text-lg">{lecture.course.code}</h3>
                            <p className="text-sm text-muted-foreground">{lecture.course.title}</p>
                            <p className="text-sm text-muted-foreground">Teacher: {lecture.course.teacher}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              {format(new Date(lecture.starts_at), 'HH:mm')} -{' '}
                              {format(new Date(lecture.ends_at), 'HH:mm')}
                            </span>
                            {lecture.room && <span>Room: {lecture.room}</span>}
                          </div>
                          {lecture.latitude && lecture.longitude && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>Location verification required (within {lecture.radius}m)</span>
                            </div>
                          )}
                          {lecture.attendance_enabled ? (
                            <Badge variant="default">Attendance Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Attendance Not Enabled</Badge>
                          )}
                        </div>
                        <Button
                          onClick={() => startCamera(lecture)}
                          disabled={!lecture.attendance_enabled || cameraActive}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Mark Attendance
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
  </div>
  );
};

export default StudentAttendance;
