import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AttendanceDB extends DBSchema {
  students: {
    key: string;
    value: {
      id: string;
      roll_no: string;
      name: string;
      embedding: number[] | null;
      created_at: string;
    };
    indexes: { 'by-roll-no': string };
  };
  courses: {
    key: string;
    value: {
      id: string;
      code: string;
      title: string;
      teacher: string;
      created_at: string;
    };
    indexes: { 'by-code': string };
  };
  lectures: {
    key: string;
    value: {
      id: string;
      course_id: string;
      starts_at: string;
      ends_at: string;
      room: string | null;
      created_at: string;
    };
    indexes: { 'by-course': string; 'by-date': string };
  };
  enrollments: {
    key: string;
    value: {
      id: string;
      student_id: string;
      course_id: string;
      created_at: string;
    };
    indexes: { 'by-student': string; 'by-course': string };
  };
  attendance: {
    key: string;
    value: {
      id: string;
      student_id: string;
      lecture_id: string;
      marked_at: string;
      confidence: number | null;
      method: string | null;
      created_at: string;
    };
    indexes: { 'by-student': string; 'by-lecture': string; 'by-date': string };
  };
  teachers: {
    key: string;
    value: {
      id: string;
      email: string;
      name: string;
      created_at: string;
    };
    indexes: { 'by-email': string };
  };
}

let dbInstance: IDBPDatabase<AttendanceDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AttendanceDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AttendanceDB>('attendance-db', 1, {
    upgrade(db) {
      // Students store
      if (!db.objectStoreNames.contains('students')) {
        const studentStore = db.createObjectStore('students', { keyPath: 'id' });
        studentStore.createIndex('by-roll-no', 'roll_no', { unique: true });
      }

      // Courses store
      if (!db.objectStoreNames.contains('courses')) {
        const courseStore = db.createObjectStore('courses', { keyPath: 'id' });
        courseStore.createIndex('by-code', 'code', { unique: true });
      }

      // Lectures store
      if (!db.objectStoreNames.contains('lectures')) {
        const lectureStore = db.createObjectStore('lectures', { keyPath: 'id' });
        lectureStore.createIndex('by-course', 'course_id');
        lectureStore.createIndex('by-date', 'starts_at');
      }

      // Enrollments store
      if (!db.objectStoreNames.contains('enrollments')) {
        const enrollmentStore = db.createObjectStore('enrollments', { keyPath: 'id' });
        enrollmentStore.createIndex('by-student', 'student_id');
        enrollmentStore.createIndex('by-course', 'course_id');
      }

      // Attendance store
      if (!db.objectStoreNames.contains('attendance')) {
        const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
        attendanceStore.createIndex('by-student', 'student_id');
        attendanceStore.createIndex('by-lecture', 'lecture_id');
        attendanceStore.createIndex('by-date', 'marked_at');
      }

      // Teachers store
      if (!db.objectStoreNames.contains('teachers')) {
        const teacherStore = db.createObjectStore('teachers', { keyPath: 'id' });
        teacherStore.createIndex('by-email', 'email', { unique: true });
      }
    },
  });

  return dbInstance;
}

export function isLocalMode(): boolean {
  return localStorage.getItem('localMode') === 'true';
}

// Helper to generate IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


