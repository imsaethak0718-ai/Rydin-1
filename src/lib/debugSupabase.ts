import { supabase } from "@/integrations/supabase/client";

export const debugSupabase = async () => {
  console.log("🔍 Starting Supabase Diagnostic...\n");

  try {
    // 0. Check network connectivity first
    console.log("0️⃣  Testing network connectivity...");
    try {
      const testResponse = await fetch("https://ylyxhdlncslvqdkhzohs.supabase.co/rest/v1/", {
        method: "HEAD",
      });
      console.log("✅ Network reachable");
      console.log("   Status:", testResponse.status);
    } catch (networkErr) {
      console.error("❌ Network unreachable - Cannot connect to Supabase servers");
      console.error("   This could be:");
      console.error("   - No internet connection");
      console.error("   - Firewall blocking supabase.co");
      console.error("   - VPN/Proxy issues");
      console.error("   Error:", (networkErr as any).message);
    }

    // 1. Check connection
    console.log("\n1️⃣  Testing connection to Supabase...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("❌ Auth error:", authError.message);
    } else {
      console.log("✅ Connected to Supabase");
      console.log("   User:", user?.email || "Not authenticated");
    }

    // 2. Check rides table exists
    console.log("\n2️⃣  Checking rides table...");
    const ridesQuery = supabase
      .from("rides")
      .select("*", { count: "exact", head: true });

    console.log("   Query URL:", (ridesQuery as any).url);
    const { data: ridesData, error: ridesError, count: ridesCount } = await ridesQuery;

    if (ridesError) {
      console.error("❌ Rides table error:", ridesError.message);
      console.error("   Code:", (ridesError as any).code);
      console.error("   Status:", (ridesError as any).status);
      console.error("   Full error:", ridesError);
    } else {
      console.log("✅ Rides table exists");
      console.log(`   Total rides: ${ridesCount}`);
    }

    // 3. Check profiles table
    console.log("\n3️⃣  Checking profiles table...");
    const { data: profilesData, error: profilesError, count: profilesCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    
    if (profilesError) {
      console.error("❌ Profiles table error:", profilesError.message);
    } else {
      console.log("✅ Profiles table exists");
      console.log(`   Total profiles: ${profilesCount}`);
    }

    // 4. Check ride_members table
    console.log("\n4️⃣  Checking ride_members table...");
    const { data: membersData, error: membersError, count: membersCount } = await supabase
      .from("ride_members")
      .select("*", { count: "exact", head: true });
    
    if (membersError) {
      console.error("❌ Ride members table error:", membersError.message);
    } else {
      console.log("✅ Ride members table exists");
      console.log(`   Total memberships: ${membersCount}`);
    }

    // 5. Check messages table
    console.log("\n5️⃣  Checking messages table...");
    const { data: messagesData, error: messagesError, count: messagesCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });
    
    if (messagesError) {
      console.error("❌ Messages table error:", messagesError.message);
    } else {
      console.log("✅ Messages table exists");
      console.log(`   Total messages: ${messagesCount}`);
    }

    // 6. Test a simple query without joins first
    console.log("\n6️⃣  Testing simple ride query (no joins)...");
    const { data: simpleRides, error: simpleError } = await supabase
      .from("rides")
      .select("id, source, destination, host_id")
      .limit(1);

    if (simpleError) {
      console.error("❌ Simple query error:", simpleError.message);
      console.error("   Status:", (simpleError as any).status);
    } else {
      console.log("✅ Simple queries work");
      if (simpleRides && simpleRides.length > 0) {
        console.log("   Sample ride:", simpleRides[0]);
      } else {
        console.log("   (No rides in database yet)");
      }
    }

    // 7. Test query with joins
    console.log("\n7️⃣  Testing ride query with joins...");
    const { data: testRides, error: joinError } = await supabase
      .from("rides")
      .select("id, source, destination, profiles!rides_host_id_fkey(name, trust_score)")
      .limit(1);

    if (joinError) {
      console.error("❌ Join query error:", joinError.message);
      console.error("   Code:", (joinError as any).code);
      console.error("   Status:", (joinError as any).status);
      console.error("   This means the foreign key or RLS policies might be misconfigured");
      console.error("   Full error:", joinError);
    } else {
      console.log("✅ Join queries work");
      if (testRides && testRides.length > 0) {
        console.log("   Sample ride:", testRides[0]);
      } else {
        console.log("   (No rides in database yet)");
      }
    }

    console.log("\n✅ Diagnostic complete!");
  } catch (err) {
    console.error("❌ Diagnostic error:", err);
  }
};

// Export a simple connection test
export const testSupabaseConnection = async (): Promise<{
  connected: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return {
        connected: false,
        message: "Supabase Auth Error",
        error: error.message,
      };
    }
    return {
      connected: true,
      message: "Connected to Supabase",
    };
  } catch (err) {
    return {
      connected: false,
      message: "Network Error - Cannot reach Supabase",
      error: (err as any).message,
    };
  }
};

// Run diagnostic on page load (development only)
if (process.env.NODE_ENV === "development") {
  console.log("💡 Tips:");
  console.log("  - Run 'debugSupabase()' to diagnose connection");
  console.log("  - Run 'testSupabaseConnection()' for quick status check");
}
