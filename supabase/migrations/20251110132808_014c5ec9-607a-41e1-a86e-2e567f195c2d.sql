-- Add attendance_enabled column to lectures table
ALTER TABLE public.lectures 
ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster queries on enabled lectures
CREATE INDEX IF NOT EXISTS idx_lectures_attendance_enabled 
ON public.lectures(attendance_enabled) 
WHERE attendance_enabled = true;