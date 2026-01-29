--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA identity;


--
-- Name: portfolio; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA portfolio;


--
-- Name: social; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA social;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: refresh_tokens; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: sms_verifications; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.sms_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    code text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    password_digest text NOT NULL,
    role integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cast_plans; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.cast_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cast_id uuid NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    duration_minutes integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cast_schedules; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.cast_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cast_id uuid NOT NULL,
    date date NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    plan_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: casts; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.casts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    tagline text,
    bio text,
    service_category text,
    location_type text,
    area text,
    visibility text DEFAULT 'offline'::text,
    promise_rate double precision,
    age integer,
    height integer,
    blood_type text,
    occupation text,
    charm_point text,
    personality text,
    bust integer,
    waist integer,
    hip integer,
    cup_size text,
    images jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    social_links jsonb DEFAULT '{}'::jsonb,
    default_schedule_start text,
    default_schedule_end text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    image_path text,
    three_sizes jsonb DEFAULT '{}'::jsonb,
    avatar_path text,
    handle character varying(30)
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL
);


--
-- Name: cast_post_hashtags; Type: TABLE; Schema: social; Owner: -
--

CREATE TABLE social.cast_post_hashtags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    tag character varying(100) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cast_post_media; Type: TABLE; Schema: social; Owner: -
--

CREATE TABLE social.cast_post_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    media_type character varying(10) NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cast_posts; Type: TABLE; Schema: social; Owner: -
--

CREATE TABLE social.cast_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cast_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible boolean DEFAULT true NOT NULL
);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: sms_verifications sms_verifications_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.sms_verifications
    ADD CONSTRAINT sms_verifications_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: cast_plans cast_plans_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_plans
    ADD CONSTRAINT cast_plans_pkey PRIMARY KEY (id);


--
-- Name: cast_schedules cast_schedules_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_schedules
    ADD CONSTRAINT cast_schedules_pkey PRIMARY KEY (id);


--
-- Name: casts casts_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.casts
    ADD CONSTRAINT casts_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: cast_post_hashtags cast_post_hashtags_pkey; Type: CONSTRAINT; Schema: social; Owner: -
--

ALTER TABLE ONLY social.cast_post_hashtags
    ADD CONSTRAINT cast_post_hashtags_pkey PRIMARY KEY (id);


--
-- Name: cast_post_media cast_post_media_pkey; Type: CONSTRAINT; Schema: social; Owner: -
--

ALTER TABLE ONLY social.cast_post_media
    ADD CONSTRAINT cast_post_media_pkey PRIMARY KEY (id);


--
-- Name: cast_posts cast_posts_pkey; Type: CONSTRAINT; Schema: social; Owner: -
--

ALTER TABLE ONLY social.cast_posts
    ADD CONSTRAINT cast_posts_pkey PRIMARY KEY (id);


--
-- Name: identity_refresh_tokens_token_index; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX identity_refresh_tokens_token_index ON identity.refresh_tokens USING btree (token);


--
-- Name: identity_refresh_tokens_user_id_index; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX identity_refresh_tokens_user_id_index ON identity.refresh_tokens USING btree (user_id);


--
-- Name: identity_sms_verifications_code_index; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX identity_sms_verifications_code_index ON identity.sms_verifications USING btree (code);


--
-- Name: identity_sms_verifications_phone_number_index; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX identity_sms_verifications_phone_number_index ON identity.sms_verifications USING btree (phone_number);


--
-- Name: identity_users_phone_number_index; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX identity_users_phone_number_index ON identity.users USING btree (phone_number);


--
-- Name: idx_casts_handle_lower; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE UNIQUE INDEX idx_casts_handle_lower ON portfolio.casts USING btree (lower((handle)::text)) WHERE (handle IS NOT NULL);


--
-- Name: portfolio_cast_plans_cast_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_plans_cast_id_index ON portfolio.cast_plans USING btree (cast_id);


--
-- Name: portfolio_cast_schedules_cast_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_schedules_cast_id_index ON portfolio.cast_schedules USING btree (cast_id);


--
-- Name: portfolio_casts_user_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE UNIQUE INDEX portfolio_casts_user_id_index ON portfolio.casts USING btree (user_id);


--
-- Name: idx_cast_posts_created_at_desc; Type: INDEX; Schema: social; Owner: -
--

CREATE INDEX idx_cast_posts_created_at_desc ON social.cast_posts USING btree (created_at DESC);


--
-- Name: social_cast_post_hashtags_post_id_index; Type: INDEX; Schema: social; Owner: -
--

CREATE INDEX social_cast_post_hashtags_post_id_index ON social.cast_post_hashtags USING btree (post_id);


--
-- Name: social_cast_post_hashtags_tag_index; Type: INDEX; Schema: social; Owner: -
--

CREATE INDEX social_cast_post_hashtags_tag_index ON social.cast_post_hashtags USING btree (tag);


--
-- Name: social_cast_post_media_post_id_index; Type: INDEX; Schema: social; Owner: -
--

CREATE INDEX social_cast_post_media_post_id_index ON social.cast_post_media USING btree (post_id);


--
-- Name: social_cast_posts_cast_id_index; Type: INDEX; Schema: social; Owner: -
--

CREATE INDEX social_cast_posts_cast_id_index ON social.cast_posts USING btree (cast_id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: cast_plans cast_plans_cast_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_plans
    ADD CONSTRAINT cast_plans_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;


--
-- Name: cast_schedules cast_schedules_cast_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_schedules
    ADD CONSTRAINT cast_schedules_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;


--
-- Name: cast_schedules cast_schedules_plan_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_schedules
    ADD CONSTRAINT cast_schedules_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES portfolio.cast_plans(id) ON DELETE SET NULL;


--
-- Name: cast_post_hashtags cast_post_hashtags_post_id_fkey; Type: FK CONSTRAINT; Schema: social; Owner: -
--

ALTER TABLE ONLY social.cast_post_hashtags
    ADD CONSTRAINT cast_post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.cast_posts(id) ON DELETE CASCADE;


--
-- Name: cast_post_media cast_post_media_post_id_fkey; Type: FK CONSTRAINT; Schema: social; Owner: -
--

ALTER TABLE ONLY social.cast_post_media
    ADD CONSTRAINT cast_post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES social.cast_posts(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


SET search_path TO "$user", public;

INSERT INTO schema_migrations (filename) VALUES
('20260114002209_create_users.rb'),
('20260114003157_create_sms_verifications.rb'),
('20260117030200_create_casts_table.rb'),
('20260118000000_create_refresh_tokens.rb'),
('20260118120000_create_cast_plans_and_schedules.rb'),
('20260118130000_add_image_path_to_casts.rb'),
('20260120100000_rename_status_to_visibility.rb'),
('20260122000000_rename_shift_to_schedule.rb'),
('20260125000000_add_three_sizes_to_casts.rb'),
('20260126000000_create_cast_posts.rb'),
('20260127000000_add_visible_to_cast_posts.rb'),
('20260128000000_add_avatar_path_to_casts.rb'),
('20260129000000_create_cast_post_hashtags.rb'),
('20260129000001_add_handle_to_casts.rb');
