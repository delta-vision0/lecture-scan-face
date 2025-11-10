import { getDB, isLocalMode, generateId } from './indexeddb';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Student {
  id: string;
  roll_no: string;
  name: string;
  embedding: number[] | null;
  created_at?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
  created_at?: string;
}

export interface Lecture {
  id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  room: string | null;
  created_at?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  created_at?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  lecture_id: string;
  marked_at: string;
  confidence: number | null;
  method: string | null;
  created_at?: string;
}

// Students API
export const studentsAPI = {
  async getAll(): Promise<Student[]> {
    if (isLocalMode()) {
      const db = await getDB();
      return db.getAll('students');
    }
    const { data, error } = await supabase.from('students').select('*').order('roll_no');
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Student | null> {
    if (isLocalMode()) {
      const db = await getDB();
      return db.get('students', id) || null;
    }
    const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(student: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
    const newStudent: Student = {
      ...student,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    if (isLocalMode()) {
      const db = await getDB();
      await db.add('students', newStudent);
      return newStudent;
    }

    const { data, error } = await supabase.from('students').insert(newStudent).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Student>): Promise<Student> {
    if (isLocalMode()) {
      const db = await getDB();
      const existing = await db.get('students', id);
      if (!existing) throw new Error('Student not found');
      const updated = { ...existing, ...updates };
      await db.put('students', updated);
      return updated;
    }

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isLocalMode()) {
      const db = await getDB();
      await db.delete('students', id);
      return;
    }

    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
  },
};

// Courses API
export const coursesAPI = {
  async getAll(): Promise<Course[]> {
    if (isLocalMode()) {
      const db = await getDB();
      return db.getAll('courses');
    }
    const { data, error } = await supabase.from('courses').select('*').order('code');
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Course | null> {
    if (isLocalMode()) {
      const db = await getDB();
      return db.get('courses', id) || null;
    }
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(course: Omit<Course, 'id' | 'created_at'>): Promise<Course> {
    const newCourse: Course = {
      ...course,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    if (isLocalMode()) {
      const db = await getDB();
      await db.add('courses', newCourse);
      return newCourse;
    }

    const { data, error } = await supabase.from('courses').insert(newCourse).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Course>): Promise<Course> {
    if (isLocalMode()) {
      const db = await getDB();
      const existing = await db.get('courses', id);
      if (!existing) throw new Error('Course not found');
      const updated = { ...existing, ...updates };
      await db.put('courses', updated);
      return updated;
    }

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isLocalMode()) {
      const db = await getDB();
      await db.delete('courses', id);
      return;
    }

    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
  },
};

// Lectures API
export const lecturesAPI = {
  async getByCourse(courseId: string): Promise<Lecture[]> {
    if (isLocalMode()) {
      const db = await getDB();
      const index = db.transaction('lectures').store.index('by-course');
      return index.getAll(courseId);
    }
    const { data, error } = await supabase
      .from('lectures')
      .select('*')
      .eq('course_id', courseId)
      .order('starts_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Lecture | null> {
    if (isLocalMode()) {
      const db = await getDB();
      return db.get('lectures', id) || null;
    }
    const { data, error } = await supabase.from('lectures').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(lecture: Omit<Lecture, 'id' | 'created_at'>): Promise<Lecture> {
    const newLecture: Lecture = {
      ...lecture,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    if (isLocalMode()) {
      const db = await getDB();
      await db.add('lectures', newLecture);
      return newLecture;
    }

    const { data, error } = await supabase.from('lectures').insert(newLecture).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (isLocalMode()) {
      const db = await getDB();
      await db.delete('lectures', id);
      return;
    }

    const { error } = await supabase.from('lectures').delete().eq('id', id);
    if (error) throw error;
  },
};

// Enrollments API
export const enrollmentsAPI = {
  async getByCourse(courseId: string): Promise<Enrollment[]> {
    if (isLocalMode()) {
      const db = await getDB();
      const index = db.transaction('enrollments').store.index('by-course');
      return index.getAll(courseId);
    }
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', courseId);
    if (error) throw error;
    return data || [];
  },

  async create(enrollment: Omit<Enrollment, 'id' | 'created_at'>): Promise<Enrollment> {
    const newEnrollment: Enrollment = {
      ...enrollment,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    if (isLocalMode()) {
      const db = await getDB();
      await db.add('enrollments', newEnrollment);
      return newEnrollment;
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert(newEnrollment)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(studentId: string, courseId: string): Promise<void> {
    if (isLocalMode()) {
      const db = await getDB();
      const index = db.transaction('enrollments').store.index('by-course');
      const enrollments = await index.getAll(courseId);
      const enrollment = enrollments.find((e) => e.student_id === studentId);
      if (enrollment) {
        await db.delete('enrollments', enrollment.id);
      }
      return;
    }

    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('student_id', studentId)
      .eq('course_id', courseId);
    if (error) throw error;
  },
};

// Attendance API
export const attendanceAPI = {
  async getByLecture(lectureId: string): Promise<Attendance[]> {
    if (isLocalMode()) {
      const db = await getDB();
      const index = db.transaction('attendance').store.index('by-lecture');
      return index.getAll(lectureId);
    }
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('lecture_id', lectureId);
    if (error) throw error;
    return data || [];
  },

  async create(attendance: Omit<Attendance, 'id' | 'created_at'>): Promise<Attendance> {
    const newAttendance: Attendance = {
      ...attendance,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    if (isLocalMode()) {
      const db = await getDB();
      await db.add('attendance', newAttendance);
      return newAttendance;
    }

    const { data, error } = await supabase
      .from('attendance')
      .insert(newAttendance)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(lectureId: string, studentId: string): Promise<void> {
    if (isLocalMode()) {
      const db = await getDB();
      const index = db.transaction('attendance').store.index('by-lecture');
      const records = await index.getAll(lectureId);
      const record = records.find((a) => a.student_id === studentId);
      if (record) {
        await db.delete('attendance', record.id);
      }
      return;
    }

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('lecture_id', lectureId)
      .eq('student_id', studentId);
    if (error) throw error;
  },
};


