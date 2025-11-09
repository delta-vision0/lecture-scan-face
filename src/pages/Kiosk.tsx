import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadFaceModels } from '@/lib/face/models';
import { getEmbeddingFromVideo, euclideanDistance } from '@/lib/face/embedding';
import { toast } from 'sonner';
import { CheckCircle2, UserX } from 'lucide-react';

interface EnrolledStudent {
  id: string;
  roll_no: string;
  name: string;
  embedding: number[];
}

interface MarkedStudent {
  roll_no: string;
  name: string;
  confidence: number;
  timestamp: Date;
}

const Kiosk = () => {
  const { lectureId } = useParams();
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [markedStudents, setMarkedStudents] = useState<Set<string>>(new Set());
  const [recentMarks, setRecentMarks] = useState<MarkedStudent[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [faceBox, setFaceBox] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lockoutMap = useRef<Map<string, number>>(new Map());
  const processingRef = useRef(false);

  useEffect(() => {
    initialize();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [lectureId]);

  const initialize = async () => {
    try {
      setStatus('Loading face models...');
      await loadFaceModels();
      
      setStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('Loading enrolled students...');
      await fetchEnrolledStudents();

      setStatus('Ready - Scanning for faces...');
      startRecognitionLoop();
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      toast.error(error.message);
    }
  };

  const fetchEnrolledStudents = async () => {
    const { data: lecture } = await supabase
      .from('lectures')
      .select('course_id')
      .eq('id', lectureId)
      .single();

    if (!lecture) throw new Error('Lecture not found');

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', lecture.course_id);

    const studentIds = enrollments?.map(e => e.student_id) || [];

    const { data: students } = await supabase
      .from('students')
      .select('id, roll_no, name, embedding')
      .in('id', studentIds)
      .not('embedding', 'is', null);

    setStudents(students || []);
  };

  const startRecognitionLoop = () => {
    const loop = async () => {
      if (processingRef.current || !videoRef.current) {
        setTimeout(loop, 300);
        return;
      }

      processingRef.current = true;
      try {
        const result = await getEmbeddingFromVideo(videoRef.current);
        
        if (result) {
          setFaceBox(result.box);
          drawFaceBox(result.box);
          await matchFace(result.descriptor);
        } else {
          setFaceBox(null);
          clearCanvas();
        }
      } catch (error) {
        console.error('Recognition error:', error);
      }
      processingRef.current = false;
      setTimeout(loop, 300);
    };

    loop();
  };

  const matchFace = async (descriptor: Float32Array) => {
    const threshold = parseFloat(localStorage.getItem('recognitionThreshold') || '0.45');
    const lockoutMinutes = parseInt(localStorage.getItem('lockoutMinutes') || '10');
    
    let bestMatch: { student: EnrolledStudent; distance: number } | null = null;

    for (const student of students) {
      const distance = euclideanDistance(descriptor, student.embedding);
      if (distance <= threshold && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { student, distance };
      }
    }

    if (bestMatch) {
      const { student, distance } = bestMatch;
      const confidence = 1 - distance;

      // Check lockout
      const lastMarked = lockoutMap.current.get(student.id);
      if (lastMarked && Date.now() - lastMarked < lockoutMinutes * 60000) {
        return;
      }

      // Check if already marked
      if (markedStudents.has(student.id)) {
        return;
      }

      // Mark attendance
      await markAttendance(student.id, confidence);
      
      lockoutMap.current.set(student.id, Date.now());
      setMarkedStudents(prev => new Set(prev).add(student.id));
      setRecentMarks(prev => [
        { roll_no: student.roll_no, name: student.name, confidence, timestamp: new Date() },
        ...prev.slice(0, 4)
      ]);

      toast.success(`Present: ${student.roll_no} — ${student.name} (${(confidence * 100).toFixed(0)}%)`);
    }
  };

  const markAttendance = async (studentId: string, confidence: number) => {
    const kioskToken = localStorage.getItem('KIOSK_TOKEN') || '';
    
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mark-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiosk-token': kioskToken,
      },
      body: JSON.stringify({
        lecture_id: lectureId,
        student_id: studentId,
        confidence,
        method: 'face',
      }),
    });
  };

  const drawFaceBox = (box: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Kiosk</h1>
        <div className="text-sm">
          <span className="font-medium">{markedStudents.size}</span> / {students.length} Present
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-6 py-3 rounded-full shadow-strong">
            <p className="text-lg font-medium">{status}</p>
          </div>
        </div>

        <div className="w-80 bg-card border-l border-border p-4 space-y-4 overflow-y-auto">
          <h2 className="font-semibold text-lg">Recently Marked</h2>
          {recentMarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance marked yet</p>
          ) : (
            <div className="space-y-2">
              {recentMarks.map((mark, i) => (
                <div key={i} className="bg-success/10 border border-success/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{mark.name}</p>
                      <p className="text-sm text-muted-foreground">{mark.roll_no}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {mark.timestamp.toLocaleTimeString()} · {(mark.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kiosk;
