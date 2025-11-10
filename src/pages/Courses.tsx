import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Calendar } from 'lucide-react';

interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
  enrollment_count?: number;
  lecture_count?: number;
}

const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [teacher, setTeacher] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (coursesError) {
      toast.error('Error fetching courses');
      setLoading(false);
      return;
    }

    // Fetch enrollment counts
    const coursesWithCounts = await Promise.all(
      (coursesData || []).map(async (course) => {
        const { count: enrollmentCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        const { count: lectureCount } = await supabase
          .from('lectures')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        return {
          ...course,
          enrollment_count: enrollmentCount || 0,
          lecture_count: lectureCount || 0,
        };
      })
    );

    setCourses(coursesWithCounts);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!code || !title || !teacher) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          code,
          title,
          teacher,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Course created successfully!');
      // Refresh the list
      await fetchCourses();
      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error creating course');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all lectures and attendance records.')) return;

    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);

      if (error) throw error;

      toast.success('Course deleted successfully');
      fetchCourses();
    } catch (error: any) {
      toast.error(error.message || 'Error deleting course');
    }
  };

  const resetForm = () => {
    setCode('');
    setTitle('');
    setTeacher('');
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Courses</h1>
            <p className="text-muted-foreground mt-1">Manage courses and lectures</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogDescription>
                  Create a new course to manage lectures and attendance
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Course Code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., CS301"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Data Structures"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">Teacher Name</Label>
                  <Input
                    id="teacher"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="e.g., Dr. Smith"
                  />
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
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Creating...' : 'Create Course'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No courses created yet. Click "Add Course" to create one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="hover:shadow-medium transition-shadow cursor-pointer"
                onClick={() => navigate(`/courses/${course.id}/lectures`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <Badge variant="secondary" className="mb-2">{course.code}</Badge>
                      <CardTitle className="text-xl">{course.title}</CardTitle>
                      <CardDescription>{course.teacher}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(course.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{course.enrollment_count || 0} students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{course.lecture_count || 0} lectures</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Courses;
