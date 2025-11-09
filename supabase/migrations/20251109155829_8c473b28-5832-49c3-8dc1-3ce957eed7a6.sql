-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Students table
create table public.students (
  id uuid primary key default uuid_generate_v4(),
  roll_no text unique not null,
  name text not null,
  embedding float8[] null,
  photo_url text null,
  created_at timestamptz default now()
);

-- Courses table
create table public.courses (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  title text not null,
  teacher text not null,
  created_at timestamptz default now()
);

-- Enrollments table
create table public.enrollments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  created_at timestamptz default now(),
  unique(student_id, course_id)
);

-- Lectures table
create table public.lectures (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text,
  created_at timestamptz default now()
);

-- Attendance table
create table public.attendance (
  id uuid primary key default uuid_generate_v4(),
  lecture_id uuid references public.lectures(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  marked_at timestamptz default now(),
  confidence numeric,
  method text default 'face',
  unique(lecture_id, student_id)
);

-- Enable Row Level Security
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.lectures enable row level security;
alter table public.attendance enable row level security;

-- RLS Policies for authenticated users (teachers)
create policy "Authenticated users can view students"
  on public.students for select
  to authenticated
  using (true);

create policy "Authenticated users can insert students"
  on public.students for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update students"
  on public.students for update
  to authenticated
  using (true);

create policy "Authenticated users can delete students"
  on public.students for delete
  to authenticated
  using (true);

create policy "Authenticated users can view courses"
  on public.courses for select
  to authenticated
  using (true);

create policy "Authenticated users can insert courses"
  on public.courses for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update courses"
  on public.courses for update
  to authenticated
  using (true);

create policy "Authenticated users can delete courses"
  on public.courses for delete
  to authenticated
  using (true);

create policy "Authenticated users can view enrollments"
  on public.enrollments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert enrollments"
  on public.enrollments for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update enrollments"
  on public.enrollments for update
  to authenticated
  using (true);

create policy "Authenticated users can delete enrollments"
  on public.enrollments for delete
  to authenticated
  using (true);

create policy "Authenticated users can view lectures"
  on public.lectures for select
  to authenticated
  using (true);

create policy "Authenticated users can insert lectures"
  on public.lectures for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update lectures"
  on public.lectures for update
  to authenticated
  using (true);

create policy "Authenticated users can delete lectures"
  on public.lectures for delete
  to authenticated
  using (true);

create policy "Authenticated users can view attendance"
  on public.attendance for select
  to authenticated
  using (true);

-- Note: attendance inserts will be handled via edge function with token validation
-- We'll add a policy for this later after creating the edge function

-- Storage bucket for face photos
insert into storage.buckets (id, name, public)
values ('faces', 'faces', true);

-- Storage policies
create policy "Public can view face images"
  on storage.objects for select
  using (bucket_id = 'faces');

create policy "Authenticated users can upload face images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'faces');

create policy "Authenticated users can update face images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'faces');

create policy "Authenticated users can delete face images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'faces');