import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kiosk-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KIOSK_TOKEN = Deno.env.get('KIOSK_TOKEN');
    if (!KIOSK_TOKEN) {
      throw new Error('KIOSK_TOKEN is not configured');
    }

    // Verify kiosk token
    const kioskToken = req.headers.get('x-kiosk-token');
    if (kioskToken !== KIOSK_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid kiosk token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { lecture_id, student_id, confidence, method = 'face' } = await req.json();

    if (!lecture_id || !student_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify lecture exists and is within time window
    const { data: lecture, error: lectureError } = await supabase
      .from('lectures')
      .select('starts_at, ends_at')
      .eq('id', lecture_id)
      .single();

    if (lectureError || !lecture) {
      return new Response(
        JSON.stringify({ error: 'Lecture not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date();
    const startsAt = new Date(lecture.starts_at);
    const endsAt = new Date(lecture.ends_at);

    if (now < startsAt || now > endsAt) {
      return new Response(
        JSON.stringify({
          error: 'Lecture is not active',
          starts_at: lecture.starts_at,
          ends_at: lecture.ends_at,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert or update attendance (upsert)
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .upsert(
        {
          lecture_id,
          student_id,
          confidence,
          method,
          marked_at: new Date().toISOString(),
        },
        {
          onConflict: 'lecture_id,student_id',
        }
      )
      .select()
      .single();

    if (attendanceError) {
      console.error('Error marking attendance:', attendanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to mark attendance' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get updated attendance count
    const { count } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('lecture_id', lecture_id);

    console.log(`Attendance marked: student=${student_id}, lecture=${lecture_id}, confidence=${confidence}`);

    return new Response(
      JSON.stringify({
        success: true,
        attendance,
        total_count: count || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in mark-attendance function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
