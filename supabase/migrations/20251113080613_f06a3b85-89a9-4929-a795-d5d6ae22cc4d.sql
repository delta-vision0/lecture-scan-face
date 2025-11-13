-- Allow unauthenticated access to read students table for login purposes
CREATE POLICY "Anyone can view students for login"
ON public.students
FOR SELECT
TO public
USING (true);