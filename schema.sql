


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "public"."labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" "text" NOT NULL,
    "office_id" "text" NOT NULL,
    "office_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "sent_at" timestamp with time zone NOT NULL,
    "status" "text",
    "files_count" integer NOT NULL,
    "error" "text",
    CONSTRAINT "logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offices" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emails" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."offices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "auto_send_enabled" boolean DEFAULT true,
    "active_template_id" "text" DEFAULT 'default'::"text",
    "scheduler" "jsonb" DEFAULT '{"hour": 8, "minute": 0, "enabled": true, "dayOfMonth": 15}'::"jsonb",
    "scheduled_office_ids" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offices"
    ADD CONSTRAINT "offices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



CREATE POLICY "Authenticated users can delete labels" ON "public"."labels" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete logs" ON "public"."logs" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete offices" ON "public"."offices" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete templates" ON "public"."templates" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert labels" ON "public"."labels" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert logs" ON "public"."logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert offices" ON "public"."offices" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert templates" ON "public"."templates" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read labels" ON "public"."labels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read logs" ON "public"."logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read offices" ON "public"."offices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read settings" ON "public"."settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read templates" ON "public"."templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update labels" ON "public"."labels" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update offices" ON "public"."offices" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update settings" ON "public"."settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update templates" ON "public"."templates" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Service role bypass labels" ON "public"."labels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass logs" ON "public"."logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass offices" ON "public"."offices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass settings" ON "public"."settings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass templates" ON "public"."templates" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."labels" TO "anon";
GRANT ALL ON TABLE "public"."labels" TO "authenticated";
GRANT ALL ON TABLE "public"."labels" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON TABLE "public"."offices" TO "anon";
GRANT ALL ON TABLE "public"."offices" TO "authenticated";
GRANT ALL ON TABLE "public"."offices" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































