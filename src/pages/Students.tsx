import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { loadFaceModels } from '@/lib/face/models';
import { getEmbeddingFromImage, getEmbeddingFromVideo } from '@/lib/face/embedding';
import { Plus, Camera, Upload, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  roll_no: string;
  name: string;
  photo_url: string | null;
  embedding: number[] | null;
}

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [useCamera, setUseCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descriptor, setDescriptor] = useState<Float32Array | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchStudents();
    loadFaceModels();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching students');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  const startCamera = async () => {
    try {
      // Ensure models are loaded first
      await loadFaceModels();
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      setCameraReady(false);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                setCameraReady(true);
              })
              .catch(err => {
                console.error('Error playing video:', err);
                toast.error('Failed to start camera preview');
              });
          }
        };
      }
      setUseCamera(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to access camera');
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) {
      toast.error('Camera not ready');
      return;
    }

    const video = videoRef.current;
    
    // Check if video is ready
    if (video.readyState < 2) {
      toast.error('Camera is still loading. Please wait...');
      return;
    }

    try {
      // Ensure models are loaded
      await loadFaceModels();
      
      const result = await getEmbeddingFromVideo(video);
      if (!result) {
        toast.error('No face detected or face too small. Move closer to the camera.');
        return;
      }

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Failed to create canvas');
        return;
      }
      
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.9);
      });
      
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setImageFile(file);
      setPreviewUrl(canvas.toDataURL('image/jpeg'));
      setDescriptor(result.descriptor);
      setFaceDetected(true);
      
      // Stop camera after capture
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setUseCamera(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      toast.success('Face captured successfully!');
    } catch (error: any) {
      console.error('Capture error:', error);
      toast.error(error.message || 'Error capturing face. Make sure your face is clearly visible.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Ensure models are loaded
      await loadFaceModels();
      
      const result = await getEmbeddingFromImage(file);
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDescriptor(result.descriptor);
      setFaceDetected(true);
      toast.success('Face detected successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Error processing image. Make sure the image contains a clear face.');
      setFaceDetected(false);
      setImageFile(null);
      setPreviewUrl(null);
      setDescriptor(null);
    }
  };

  const handleSave = async () => {
    if (!rollNo || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!descriptor || !imageFile) {
      toast.error('Please capture or upload a face image');
      return;
    }

    setSaving(true);

    try {
      // Upload image to storage
      const fileName = `${rollNo}-${Date.now()}.jpg`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('faces')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('faces')
        .getPublicUrl(fileName);

      // Save student with embedding
      const { error: insertError } = await supabase
        .from('students')
        .insert({
          roll_no: rollNo,
          name,
          photo_url: publicUrl,
          embedding: Array.from(descriptor),
        });

      if (insertError) {
        // Clean up uploaded image if insert fails
        await supabase.storage.from('faces').remove([fileName]);
        throw insertError;
      }

      toast.success('Student enrolled successfully!');
      fetchStudents();
      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error saving student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, photoUrl: string | null) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Delete photo from storage if exists
      if (photoUrl) {
        const fileName = photoUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('faces').remove([fileName]);
        }
      }

      toast.success('Student deleted successfully');
      fetchStudents();
    } catch (error: any) {
      toast.error(error.message || 'Error deleting student');
    }
  };

  const resetForm = () => {
    setRollNo('');
    setName('');
    setImageFile(null);
    setPreviewUrl(null);
    setFaceDetected(false);
    setDescriptor(null);
    setUseCamera(false);
    setCameraReady(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">Manage student enrollment and face data</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Enroll Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Enroll New Student</DialogTitle>
                <DialogDescription>
                  Capture or upload a clear face photo for automatic attendance
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="roll-no">Roll Number</Label>
                    <Input
                      id="roll-no"
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      placeholder="e.g., CS2024001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {!useCamera && !previewUrl && (
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startCamera}
                        className="flex-1 gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Capture from Webcam
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="flex-1 gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Image
                      </Button>
                      <input
                        id="file-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}

                  {useCamera && (
                    <div className="space-y-3">
                      <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ minHeight: '400px' }}
                        />
                        {!cameraReady && (
                          <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 rounded-lg">
                            <div className="text-center">
                              <Camera className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
                              <p className="text-sm">Starting camera...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          onClick={captureFromCamera} 
                          className="flex-1"
                          disabled={!cameraReady || !stream}
                        >
                          {cameraReady ? 'Capture Photo' : 'Camera Loading...'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (stream) {
                              stream.getTracks().forEach(track => track.stop());
                              setStream(null);
                            }
                            setUseCamera(false);
                            setCameraReady(false);
                            if (videoRef.current) {
                              videoRef.current.srcObject = null;
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {previewUrl && (
                    <div className="space-y-3">
                      <div className="relative">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full max-h-64 object-contain rounded-lg border"
                        />
                        {faceDetected && (
                          <div className="absolute top-2 right-2 bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-medium">
                            Face Detected ✓
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="w-full"
                      >
                        Retake / Choose Different Image
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!faceDetected || saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : 'Enroll Student'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enrolled Students</CardTitle>
            <CardDescription>Total: {students.length} students</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : students.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No students enrolled yet. Click "Enroll Student" to add one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Face Data</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                            No photo
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{student.roll_no}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        {student.embedding ? (
                          <span className="text-success text-sm">✓ Enrolled</span>
                        ) : (
                          <span className="text-warning text-sm">⚠ Missing</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(student.id, student.photo_url)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Students;
