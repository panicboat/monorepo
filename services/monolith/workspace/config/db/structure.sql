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
-- Name: media; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA media;


--
-- Name: offer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA offer;


--
-- Name: portfolio; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA portfolio;


--
-- Name: post; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA post;


--
-- Name: relationship; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA relationship;


--
-- Name: social; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA social;


--
-- Name: trust; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA trust;


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
-- Name: files; Type: TABLE; Schema: media; Owner: -
--

CREATE TABLE media.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_type character varying(10) NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    filename character varying(255),
    content_type character varying(100),
    size_bytes bigint,
    media_key text,
    thumbnail_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: offer; Owner: -
--

CREATE TABLE offer.plans (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_plans_id_not_null NOT NULL,
    cast_id uuid CONSTRAINT cast_plans_cast_id_not_null NOT NULL,
    name text CONSTRAINT cast_plans_name_not_null NOT NULL,
    price integer CONSTRAINT cast_plans_price_not_null NOT NULL,
    duration_minutes integer CONSTRAINT cast_plans_duration_minutes_not_null NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cast_plans_created_at_not_null NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cast_plans_updated_at_not_null NOT NULL,
    is_recommended boolean DEFAULT false CONSTRAINT cast_plans_is_recommended_not_null NOT NULL
);


--
-- Name: schedules; Type: TABLE; Schema: offer; Owner: -
--

CREATE TABLE offer.schedules (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_schedules_id_not_null NOT NULL,
    cast_id uuid CONSTRAINT cast_schedules_cast_id_not_null NOT NULL,
    date date CONSTRAINT cast_schedules_date_not_null NOT NULL,
    start_time text CONSTRAINT cast_schedules_start_time_not_null NOT NULL,
    end_time text CONSTRAINT cast_schedules_end_time_not_null NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cast_schedules_created_at_not_null NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT cast_schedules_updated_at_not_null NOT NULL
);


--
-- Name: areas; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prefecture character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cast_areas; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.cast_areas (
    cast_id uuid NOT NULL,
    area_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cast_gallery_media; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.cast_gallery_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cast_id uuid NOT NULL,
    media_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cast_genres; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.cast_genres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cast_id uuid NOT NULL,
    genre_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    visibility text DEFAULT 'offline'::text,
    age integer,
    height integer,
    blood_type text,
    tags jsonb DEFAULT '[]'::jsonb,
    social_links jsonb DEFAULT '{}'::jsonb,
    default_schedule_start text,
    default_schedule_end text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    three_sizes jsonb DEFAULT '{}'::jsonb,
    slug character varying(30),
    registered_at timestamp with time zone,
    profile_media_id uuid,
    avatar_media_id uuid
);


--
-- Name: genres; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.genres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: guests; Type: TABLE; Schema: portfolio; Owner: -
--

CREATE TABLE portfolio.guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tagline character varying(100),
    bio text,
    avatar_media_id uuid
);


--
-- Name: comment_media; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.comment_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    media_type character varying(10) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    media_id uuid
);


--
-- Name: comments; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.comments (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT post_comments_id_not_null NOT NULL,
    post_id uuid CONSTRAINT post_comments_post_id_not_null NOT NULL,
    parent_id uuid,
    user_id uuid CONSTRAINT post_comments_user_id_not_null NOT NULL,
    content text CONSTRAINT post_comments_content_not_null NOT NULL,
    replies_count integer DEFAULT 0 CONSTRAINT post_comments_replies_count_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT post_comments_created_at_not_null NOT NULL
);


--
-- Name: hashtags; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.hashtags (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_post_hashtags_id_not_null NOT NULL,
    post_id uuid CONSTRAINT cast_post_hashtags_post_id_not_null NOT NULL,
    tag character varying(100) CONSTRAINT cast_post_hashtags_tag_not_null NOT NULL,
    "position" integer DEFAULT 0 CONSTRAINT cast_post_hashtags_position_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cast_post_hashtags_created_at_not_null NOT NULL
);


--
-- Name: likes; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.likes (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT post_likes_id_not_null NOT NULL,
    post_id uuid CONSTRAINT post_likes_post_id_not_null NOT NULL,
    guest_id uuid CONSTRAINT post_likes_guest_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT post_likes_created_at_not_null NOT NULL
);


--
-- Name: post_media; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.post_media (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_post_media_id_not_null NOT NULL,
    post_id uuid CONSTRAINT cast_post_media_post_id_not_null NOT NULL,
    media_type character varying(10) CONSTRAINT cast_post_media_media_type_not_null NOT NULL,
    "position" integer DEFAULT 0 CONSTRAINT cast_post_media_position_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cast_post_media_created_at_not_null NOT NULL,
    media_id uuid
);


--
-- Name: posts; Type: TABLE; Schema: post; Owner: -
--

CREATE TABLE post.posts (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_posts_id_not_null NOT NULL,
    cast_id uuid CONSTRAINT cast_posts_cast_id_not_null NOT NULL,
    content text CONSTRAINT cast_posts_content_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cast_posts_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT cast_posts_updated_at_not_null NOT NULL,
    visibility text DEFAULT 'public'::text CONSTRAINT cast_posts_visibility_not_null NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL
);


--
-- Name: blocks; Type: TABLE; Schema: relationship; Owner: -
--

CREATE TABLE relationship.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocker_type text NOT NULL,
    blocked_id uuid NOT NULL,
    blocked_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: relationship; Owner: -
--

CREATE TABLE relationship.favorites (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_favorites_id_not_null NOT NULL,
    cast_id uuid CONSTRAINT cast_favorites_cast_id_not_null NOT NULL,
    guest_id uuid CONSTRAINT cast_favorites_guest_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cast_favorites_created_at_not_null NOT NULL
);


--
-- Name: follows; Type: TABLE; Schema: relationship; Owner: -
--

CREATE TABLE relationship.follows (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cast_follows_id_not_null NOT NULL,
    cast_id uuid CONSTRAINT cast_follows_cast_id_not_null NOT NULL,
    guest_id uuid CONSTRAINT cast_follows_guest_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cast_follows_created_at_not_null NOT NULL,
    status text DEFAULT 'approved'::text CONSTRAINT cast_follows_status_not_null NOT NULL
);


--
-- Name: taggings; Type: TABLE; Schema: trust; Owner: -
--

CREATE TABLE trust.taggings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tagger_id uuid NOT NULL,
    target_id uuid NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tag_name character varying(100) NOT NULL
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
-- Name: files files_pkey; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: plans cast_plans_pkey; Type: CONSTRAINT; Schema: offer; Owner: -
--

ALTER TABLE ONLY offer.plans
    ADD CONSTRAINT cast_plans_pkey PRIMARY KEY (id);


--
-- Name: schedules cast_schedules_pkey; Type: CONSTRAINT; Schema: offer; Owner: -
--

ALTER TABLE ONLY offer.schedules
    ADD CONSTRAINT cast_schedules_pkey PRIMARY KEY (id);


--
-- Name: areas areas_code_key; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.areas
    ADD CONSTRAINT areas_code_key UNIQUE (code);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: cast_areas cast_areas_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_areas
    ADD CONSTRAINT cast_areas_pkey PRIMARY KEY (cast_id, area_id);


--
-- Name: cast_gallery_media cast_gallery_media_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_gallery_media
    ADD CONSTRAINT cast_gallery_media_pkey PRIMARY KEY (id);


--
-- Name: cast_genres cast_genres_cast_id_genre_id_key; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_genres
    ADD CONSTRAINT cast_genres_cast_id_genre_id_key UNIQUE (cast_id, genre_id);


--
-- Name: cast_genres cast_genres_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_genres
    ADD CONSTRAINT cast_genres_pkey PRIMARY KEY (id);


--
-- Name: casts casts_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.casts
    ADD CONSTRAINT casts_pkey PRIMARY KEY (id);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- Name: genres genres_slug_key; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.genres
    ADD CONSTRAINT genres_slug_key UNIQUE (slug);


--
-- Name: guests guests_pkey; Type: CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.guests
    ADD CONSTRAINT guests_pkey PRIMARY KEY (id);


--
-- Name: hashtags cast_post_hashtags_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.hashtags
    ADD CONSTRAINT cast_post_hashtags_pkey PRIMARY KEY (id);


--
-- Name: post_media cast_post_media_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.post_media
    ADD CONSTRAINT cast_post_media_pkey PRIMARY KEY (id);


--
-- Name: posts cast_posts_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.posts
    ADD CONSTRAINT cast_posts_pkey PRIMARY KEY (id);


--
-- Name: comment_media comment_media_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.comment_media
    ADD CONSTRAINT comment_media_pkey PRIMARY KEY (id);


--
-- Name: comments post_comments_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);


--
-- Name: likes post_likes_pkey; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- Name: likes post_likes_post_id_guest_id_key; Type: CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.likes
    ADD CONSTRAINT post_likes_post_id_guest_id_key UNIQUE (post_id, guest_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: blocks blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.blocks
    ADD CONSTRAINT blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: favorites cast_favorites_cast_id_guest_id_key; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.favorites
    ADD CONSTRAINT cast_favorites_cast_id_guest_id_key UNIQUE (cast_id, guest_id);


--
-- Name: favorites cast_favorites_pkey; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.favorites
    ADD CONSTRAINT cast_favorites_pkey PRIMARY KEY (id);


--
-- Name: follows cast_follows_cast_id_guest_id_key; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.follows
    ADD CONSTRAINT cast_follows_cast_id_guest_id_key UNIQUE (cast_id, guest_id);


--
-- Name: follows cast_follows_pkey; Type: CONSTRAINT; Schema: relationship; Owner: -
--

ALTER TABLE ONLY relationship.follows
    ADD CONSTRAINT cast_follows_pkey PRIMARY KEY (id);


--
-- Name: taggings taggings_pkey; Type: CONSTRAINT; Schema: trust; Owner: -
--

ALTER TABLE ONLY trust.taggings
    ADD CONSTRAINT taggings_pkey PRIMARY KEY (id);


--
-- Name: taggings taggings_tag_name_target_id_tagger_id_key; Type: CONSTRAINT; Schema: trust; Owner: -
--

ALTER TABLE ONLY trust.taggings
    ADD CONSTRAINT taggings_tag_name_target_id_tagger_id_key UNIQUE (tag_name, target_id, tagger_id);


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
-- Name: media_files_media_key_index; Type: INDEX; Schema: media; Owner: -
--

CREATE UNIQUE INDEX media_files_media_key_index ON media.files USING btree (media_key) WHERE (media_key IS NOT NULL);


--
-- Name: portfolio_cast_plans_cast_id_index; Type: INDEX; Schema: offer; Owner: -
--

CREATE INDEX portfolio_cast_plans_cast_id_index ON offer.plans USING btree (cast_id);


--
-- Name: portfolio_cast_schedules_cast_id_index; Type: INDEX; Schema: offer; Owner: -
--

CREATE INDEX portfolio_cast_schedules_cast_id_index ON offer.schedules USING btree (cast_id);


--
-- Name: idx_cast_areas_area_id; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX idx_cast_areas_area_id ON portfolio.cast_areas USING btree (area_id);


--
-- Name: idx_casts_slug_lower; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE UNIQUE INDEX idx_casts_slug_lower ON portfolio.casts USING btree (lower((slug)::text)) WHERE (slug IS NOT NULL);


--
-- Name: portfolio_cast_gallery_media_cast_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_gallery_media_cast_id_index ON portfolio.cast_gallery_media USING btree (cast_id);


--
-- Name: portfolio_cast_gallery_media_cast_id_position_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_gallery_media_cast_id_position_index ON portfolio.cast_gallery_media USING btree (cast_id, "position");


--
-- Name: portfolio_cast_gallery_media_media_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_gallery_media_media_id_index ON portfolio.cast_gallery_media USING btree (media_id);


--
-- Name: portfolio_cast_genres_cast_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_genres_cast_id_index ON portfolio.cast_genres USING btree (cast_id);


--
-- Name: portfolio_cast_genres_genre_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_cast_genres_genre_id_index ON portfolio.cast_genres USING btree (genre_id);


--
-- Name: portfolio_casts_avatar_media_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_casts_avatar_media_id_index ON portfolio.casts USING btree (avatar_media_id);


--
-- Name: portfolio_casts_profile_media_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_casts_profile_media_id_index ON portfolio.casts USING btree (profile_media_id);


--
-- Name: portfolio_casts_user_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE UNIQUE INDEX portfolio_casts_user_id_index ON portfolio.casts USING btree (user_id);


--
-- Name: portfolio_guests_avatar_media_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE INDEX portfolio_guests_avatar_media_id_index ON portfolio.guests USING btree (avatar_media_id);


--
-- Name: portfolio_guests_user_id_index; Type: INDEX; Schema: portfolio; Owner: -
--

CREATE UNIQUE INDEX portfolio_guests_user_id_index ON portfolio.guests USING btree (user_id);


--
-- Name: idx_cast_posts_created_at_desc; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX idx_cast_posts_created_at_desc ON post.posts USING btree (created_at DESC);


--
-- Name: idx_post_comments_created_at_desc; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX idx_post_comments_created_at_desc ON post.comments USING btree (created_at DESC);


--
-- Name: post_comment_media_media_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX post_comment_media_media_id_index ON post.comment_media USING btree (media_id);


--
-- Name: post_post_media_media_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX post_post_media_media_id_index ON post.post_media USING btree (media_id);


--
-- Name: social_cast_post_hashtags_post_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_cast_post_hashtags_post_id_index ON post.hashtags USING btree (post_id);


--
-- Name: social_cast_post_hashtags_tag_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_cast_post_hashtags_tag_index ON post.hashtags USING btree (tag);


--
-- Name: social_cast_post_media_post_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_cast_post_media_post_id_index ON post.post_media USING btree (post_id);


--
-- Name: social_cast_posts_cast_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_cast_posts_cast_id_index ON post.posts USING btree (cast_id);


--
-- Name: social_comment_media_comment_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_comment_media_comment_id_index ON post.comment_media USING btree (comment_id);


--
-- Name: social_post_comments_parent_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_post_comments_parent_id_index ON post.comments USING btree (parent_id);


--
-- Name: social_post_comments_post_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_post_comments_post_id_index ON post.comments USING btree (post_id);


--
-- Name: social_post_comments_user_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_post_comments_user_id_index ON post.comments USING btree (user_id);


--
-- Name: social_post_likes_guest_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_post_likes_guest_id_index ON post.likes USING btree (guest_id);


--
-- Name: social_post_likes_post_id_index; Type: INDEX; Schema: post; Owner: -
--

CREATE INDEX social_post_likes_post_id_index ON post.likes USING btree (post_id);


--
-- Name: social_blocks_blocked_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_blocks_blocked_id_index ON relationship.blocks USING btree (blocked_id);


--
-- Name: social_blocks_blocker_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_blocks_blocker_id_index ON relationship.blocks USING btree (blocker_id);


--
-- Name: social_cast_favorites_cast_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_cast_favorites_cast_id_index ON relationship.favorites USING btree (cast_id);


--
-- Name: social_cast_favorites_guest_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_cast_favorites_guest_id_index ON relationship.favorites USING btree (guest_id);


--
-- Name: social_cast_follows_cast_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_cast_follows_cast_id_index ON relationship.follows USING btree (cast_id);


--
-- Name: social_cast_follows_guest_id_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_cast_follows_guest_id_index ON relationship.follows USING btree (guest_id);


--
-- Name: social_cast_follows_status_index; Type: INDEX; Schema: relationship; Owner: -
--

CREATE INDEX social_cast_follows_status_index ON relationship.follows USING btree (status);


--
-- Name: trust_taggings_tagger_id_index; Type: INDEX; Schema: trust; Owner: -
--

CREATE INDEX trust_taggings_tagger_id_index ON trust.taggings USING btree (tagger_id);


--
-- Name: trust_taggings_target_id_index; Type: INDEX; Schema: trust; Owner: -
--

CREATE INDEX trust_taggings_target_id_index ON trust.taggings USING btree (target_id);


--
-- Name: trust_taggings_target_id_status_index; Type: INDEX; Schema: trust; Owner: -
--

CREATE INDEX trust_taggings_target_id_status_index ON trust.taggings USING btree (target_id, status);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: cast_areas cast_areas_area_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_areas
    ADD CONSTRAINT cast_areas_area_id_fkey FOREIGN KEY (area_id) REFERENCES portfolio.areas(id) ON DELETE CASCADE;


--
-- Name: cast_areas cast_areas_cast_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_areas
    ADD CONSTRAINT cast_areas_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;


--
-- Name: cast_gallery_media cast_gallery_media_cast_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_gallery_media
    ADD CONSTRAINT cast_gallery_media_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;


--
-- Name: cast_genres cast_genres_cast_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_genres
    ADD CONSTRAINT cast_genres_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;


--
-- Name: cast_genres cast_genres_genre_id_fkey; Type: FK CONSTRAINT; Schema: portfolio; Owner: -
--

ALTER TABLE ONLY portfolio.cast_genres
    ADD CONSTRAINT cast_genres_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES portfolio.genres(id) ON DELETE CASCADE;


--
-- Name: hashtags cast_post_hashtags_post_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.hashtags
    ADD CONSTRAINT cast_post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES post.posts(id) ON DELETE CASCADE;


--
-- Name: post_media cast_post_media_post_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.post_media
    ADD CONSTRAINT cast_post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES post.posts(id) ON DELETE CASCADE;


--
-- Name: comment_media comment_media_comment_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.comment_media
    ADD CONSTRAINT comment_media_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES post.comments(id) ON DELETE CASCADE;


--
-- Name: comments post_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.comments
    ADD CONSTRAINT post_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES post.comments(id) ON DELETE CASCADE;


--
-- Name: comments post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES post.posts(id) ON DELETE CASCADE;


--
-- Name: likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: post; Owner: -
--

ALTER TABLE ONLY post.likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES post.posts(id) ON DELETE CASCADE;


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
('20260129000001_add_handle_to_casts.rb'),
('20260129000002_create_areas.rb'),
('20260129000003_create_cast_areas.rb'),
('20260131000000_remove_deprecated_columns_from_casts.rb'),
('20260131001000_create_genres.rb'),
('20260131002000_create_cast_genres.rb'),
('20260201000000_create_guests.rb'),
('20260201000001_add_tagline_bio_to_guests.rb'),
('20260203000000_create_post_likes.rb'),
('20260203000001_create_cast_follows.rb'),
('20260205000000_create_post_comments.rb'),
('20260205000001_create_comment_media.rb'),
('20260207000000_create_blocks.rb'),
('20260208000000_create_cast_favorites.rb'),
('20260209000000_add_registered_at_to_casts.rb'),
('20260209000001_migrate_cast_visibility_values.rb'),
('20260209000002_add_status_to_cast_follows.rb'),
('20260210000000_add_is_recommended_to_cast_plans.rb'),
('20260210100000_rename_visible_to_visibility_in_cast_posts.rb'),
('20260211000000_rename_handle_to_slug_in_casts.rb'),
('20260213014603_remove_plan_id_from_cast_schedules.rb'),
('20260213020000_allow_null_price_on_cast_plans.rb'),
('20260213030000_revert_null_price_on_cast_plans.rb'),
('20260216000000_move_plans_schedules_to_offer.rb'),
('20260216000000_split_social_schema.rb'),
('20260216100000_rename_offer_tables.rb'),
('20260217000000_create_media_files.rb'),
('20260218000000_remove_cross_schema_foreign_keys.rb'),
('20260218100000_add_media_id_to_post_media.rb'),
('20260218100001_make_url_nullable_on_post_media.rb'),
('20260218200000_add_media_id_to_casts.rb'),
('20260218210000_add_avatar_media_id_to_guests.rb'),
('20260218220000_remove_legacy_media_columns.rb'),
('20260220000001_create_trust_tags.rb'),
('20260220000002_create_trust_taggings.rb'),
('20260221000001_refactor_trust_freeform_tagging.rb');
