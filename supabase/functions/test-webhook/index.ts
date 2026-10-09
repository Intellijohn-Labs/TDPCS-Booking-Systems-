// Supabase Edge Function: test-webhook
// Sends test booking event to n8n webhook URL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await clientWithAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.active) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: webhookSetting } = await adminClient
      .from("settings")
      .select("value")
      .eq("key", "n8n_webhook_url")
      .single();

    const webhookUrl = webhookSetting?.value;
    if (!webhookUrl || webhookUrl.trim() === "" || webhookUrl.includes("<")) {
      return new Response(
        JSON.stringify({ error: "n8n_webhook_url is not configured or contains placeholder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: clientNumSetting } = await adminClient
      .from("settings")
      .select("value")
      .eq("key", "client_notify_number")
      .single();

    const testPayload = {
      event: "booked",
      booking: {
        id: 99999,
        token_no: "T-TEST",
        customer_name: "Test Customer",
        mobile: "919876543210",
        day: new Date().toISOString().split("T")[0],
        counter: 1,
        slot_start: new Date().toISOString(),
        slot_end: new Date(Date.now() + 20 * 60000).toISOString(),
        report_time: new Date(Date.now() - 10 * 60000).toISOString(),
        product_ids: [1],
        status: "booked",
        cancel_reason: null,
      },
      previous: null,
      client_number: clientNumSetting?.value || "",
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();

    return new Response(
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        response: responseText,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to trigger webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
