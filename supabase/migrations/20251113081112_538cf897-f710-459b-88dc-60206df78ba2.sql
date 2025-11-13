-- Add photo_url column to attendance table for storing student selfies
ALTER TABLE public.attendance 
ADD COLUMN photo_url text;