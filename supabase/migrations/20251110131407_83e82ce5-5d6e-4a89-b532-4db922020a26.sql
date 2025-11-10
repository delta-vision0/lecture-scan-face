-- Add GPS location fields to lectures table
ALTER TABLE public.lectures 
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric,
ADD COLUMN radius numeric DEFAULT 100;

-- Add comment for clarity
COMMENT ON COLUMN public.lectures.latitude IS 'Latitude coordinate for GPS-based attendance';
COMMENT ON COLUMN public.lectures.longitude IS 'Longitude coordinate for GPS-based attendance';
COMMENT ON COLUMN public.lectures.radius IS 'Allowed radius in meters for GPS-based attendance';