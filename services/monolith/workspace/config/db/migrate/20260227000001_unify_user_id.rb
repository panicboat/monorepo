# frozen_string_literal: true

# Unify all profile-based IDs (cast_id/guest_id) to user_id across the entire database.
#
# This migration:
# 1. Adds cast_user_id / guest_user_id columns to all dependent tables
# 2. Migrates data from old profile IDs to user IDs (via JOIN to portfolio.casts/guests)
# 3. Drops old cast_id / guest_id columns
# 4. Changes PK of portfolio.casts and portfolio.guests from id to user_id
# 5. Re-establishes FK constraints for same-schema tables
#
# This is NOT reversible - restore from backup if needed.

ROM::SQL.migration do
  up do
    # =========================================================================
    # PHASE 1: Migrate dependent tables (cast_id -> cast_user_id)
    # =========================================================================

    # -----------------------------------------------------------------------
    # 1a. portfolio.cast_areas (composite PK [cast_id, area_id])
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      DROP CONSTRAINT cast_areas_cast_id_fkey;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      DROP CONSTRAINT cast_areas_pkey;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE portfolio.cast_areas ca
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE ca.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM portfolio.cast_areas
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      ADD CONSTRAINT cast_areas_pkey PRIMARY KEY (cast_user_id, area_id);
    SQL

    # -----------------------------------------------------------------------
    # 1b. portfolio.cast_genres (unique [cast_id, genre_id])
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      DROP CONSTRAINT cast_genres_cast_id_fkey;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      DROP CONSTRAINT cast_genres_cast_id_genre_id_key;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS portfolio.portfolio_cast_genres_cast_id_index;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE portfolio.cast_genres cg
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE cg.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM portfolio.cast_genres
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      ADD CONSTRAINT cast_genres_cast_user_id_genre_id_key UNIQUE (cast_user_id, genre_id);
    SQL

    run <<-SQL
      CREATE INDEX portfolio_cast_genres_cast_user_id_index
      ON portfolio.cast_genres USING btree (cast_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1c. portfolio.cast_gallery_media
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE portfolio.cast_gallery_media
      DROP CONSTRAINT cast_gallery_media_cast_id_fkey;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS portfolio.portfolio_cast_gallery_media_cast_id_index;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS portfolio.portfolio_cast_gallery_media_cast_id_position_index;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_gallery_media
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE portfolio.cast_gallery_media cgm
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE cgm.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM portfolio.cast_gallery_media
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_gallery_media
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_gallery_media
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      CREATE INDEX portfolio_cast_gallery_media_cast_user_id_index
      ON portfolio.cast_gallery_media USING btree (cast_user_id);
    SQL

    run <<-SQL
      CREATE INDEX portfolio_cast_gallery_media_cast_user_id_position_index
      ON portfolio.cast_gallery_media USING btree (cast_user_id, "position");
    SQL

    # -----------------------------------------------------------------------
    # 1d. offer.plans (cross-schema, no FK)
    # -----------------------------------------------------------------------
    run <<-SQL
      DROP INDEX IF EXISTS offer.portfolio_cast_plans_cast_id_index;
    SQL

    run <<-SQL
      ALTER TABLE offer.plans
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE offer.plans p
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE p.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM offer.plans
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE offer.plans
      DROP CONSTRAINT cast_plans_cast_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE offer.plans
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE offer.plans
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      CREATE INDEX offer_plans_cast_user_id_index
      ON offer.plans USING btree (cast_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1e. offer.schedules (cross-schema, no FK)
    # -----------------------------------------------------------------------
    run <<-SQL
      DROP INDEX IF EXISTS offer.portfolio_cast_schedules_cast_id_index;
    SQL

    run <<-SQL
      ALTER TABLE offer.schedules
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE offer.schedules s
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE s.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM offer.schedules
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE offer.schedules
      DROP CONSTRAINT cast_schedules_cast_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE offer.schedules
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE offer.schedules
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      CREATE INDEX offer_schedules_cast_user_id_index
      ON offer.schedules USING btree (cast_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1f. post.posts (cross-schema, no FK)
    # -----------------------------------------------------------------------
    run <<-SQL
      DROP INDEX IF EXISTS post.social_cast_posts_cast_id_index;
    SQL

    run <<-SQL
      ALTER TABLE post.posts
      ADD COLUMN cast_user_id uuid;
    SQL

    run <<-SQL
      UPDATE post.posts p
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE p.cast_id = c.id;
    SQL

    run <<-SQL
      DELETE FROM post.posts
      WHERE cast_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE post.posts
      DROP CONSTRAINT cast_posts_cast_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE post.posts
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE post.posts
      DROP COLUMN cast_id;
    SQL

    run <<-SQL
      CREATE INDEX post_posts_cast_user_id_index
      ON post.posts USING btree (cast_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1g. post.likes (guest_id -> guest_user_id, unique [post_id, guest_id])
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE post.likes
      DROP CONSTRAINT post_likes_post_id_guest_id_key;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS post.social_post_likes_guest_id_index;
    SQL

    run <<-SQL
      ALTER TABLE post.likes
      ADD COLUMN guest_user_id uuid;
    SQL

    run <<-SQL
      UPDATE post.likes l
      SET guest_user_id = g.user_id
      FROM portfolio.guests g
      WHERE l.guest_id = g.id;
    SQL

    run <<-SQL
      DELETE FROM post.likes
      WHERE guest_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE post.likes
      DROP CONSTRAINT post_likes_guest_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE post.likes
      ALTER COLUMN guest_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE post.likes
      DROP COLUMN guest_id;
    SQL

    run <<-SQL
      ALTER TABLE post.likes
      ADD CONSTRAINT post_likes_post_id_guest_user_id_key UNIQUE (post_id, guest_user_id);
    SQL

    run <<-SQL
      CREATE INDEX post_likes_guest_user_id_index
      ON post.likes USING btree (guest_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1h. relationship.follows (cast_id + guest_id, unique constraint)
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE relationship.follows
      DROP CONSTRAINT cast_follows_cast_id_guest_id_key;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS relationship.social_cast_follows_cast_id_index;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS relationship.social_cast_follows_guest_id_index;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      ADD COLUMN cast_user_id uuid,
      ADD COLUMN guest_user_id uuid;
    SQL

    run <<-SQL
      UPDATE relationship.follows f
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE f.cast_id = c.id;
    SQL

    run <<-SQL
      UPDATE relationship.follows f
      SET guest_user_id = g.user_id
      FROM portfolio.guests g
      WHERE f.guest_id = g.id;
    SQL

    run <<-SQL
      DELETE FROM relationship.follows
      WHERE cast_user_id IS NULL OR guest_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      DROP CONSTRAINT cast_follows_cast_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      DROP CONSTRAINT cast_follows_guest_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      ALTER COLUMN cast_user_id SET NOT NULL,
      ALTER COLUMN guest_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      DROP COLUMN cast_id,
      DROP COLUMN guest_id;
    SQL

    run <<-SQL
      ALTER TABLE relationship.follows
      ADD CONSTRAINT follows_cast_user_id_guest_user_id_key UNIQUE (cast_user_id, guest_user_id);
    SQL

    run <<-SQL
      CREATE INDEX relationship_follows_cast_user_id_index
      ON relationship.follows USING btree (cast_user_id);
    SQL

    run <<-SQL
      CREATE INDEX relationship_follows_guest_user_id_index
      ON relationship.follows USING btree (guest_user_id);
    SQL

    # -----------------------------------------------------------------------
    # 1i. relationship.favorites (cast_id + guest_id, unique constraint)
    # -----------------------------------------------------------------------
    run <<-SQL
      ALTER TABLE relationship.favorites
      DROP CONSTRAINT cast_favorites_cast_id_guest_id_key;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS relationship.social_cast_favorites_cast_id_index;
    SQL

    run <<-SQL
      DROP INDEX IF EXISTS relationship.social_cast_favorites_guest_id_index;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      ADD COLUMN cast_user_id uuid,
      ADD COLUMN guest_user_id uuid;
    SQL

    run <<-SQL
      UPDATE relationship.favorites f
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE f.cast_id = c.id;
    SQL

    run <<-SQL
      UPDATE relationship.favorites f
      SET guest_user_id = g.user_id
      FROM portfolio.guests g
      WHERE f.guest_id = g.id;
    SQL

    run <<-SQL
      DELETE FROM relationship.favorites
      WHERE cast_user_id IS NULL OR guest_user_id IS NULL;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      DROP CONSTRAINT cast_favorites_cast_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      DROP CONSTRAINT cast_favorites_guest_id_not_null;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      ALTER COLUMN cast_user_id SET NOT NULL,
      ALTER COLUMN guest_user_id SET NOT NULL;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      DROP COLUMN cast_id,
      DROP COLUMN guest_id;
    SQL

    run <<-SQL
      ALTER TABLE relationship.favorites
      ADD CONSTRAINT favorites_cast_user_id_guest_user_id_key UNIQUE (cast_user_id, guest_user_id);
    SQL

    run <<-SQL
      CREATE INDEX relationship_favorites_cast_user_id_index
      ON relationship.favorites USING btree (cast_user_id);
    SQL

    run <<-SQL
      CREATE INDEX relationship_favorites_guest_user_id_index
      ON relationship.favorites USING btree (guest_user_id);
    SQL

    # =========================================================================
    # PHASE 2: Change PK of portfolio.casts from id to user_id
    # =========================================================================
    run <<-SQL
      ALTER TABLE portfolio.casts
      DROP CONSTRAINT casts_pkey;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.casts
      DROP COLUMN id;
    SQL

    # Drop the unique index on user_id (it becomes the PK)
    run <<-SQL
      DROP INDEX IF EXISTS portfolio.portfolio_casts_user_id_index;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.casts
      ADD CONSTRAINT casts_pkey PRIMARY KEY (user_id);
    SQL

    # =========================================================================
    # PHASE 3: Change PK of portfolio.guests from id to user_id
    # =========================================================================
    run <<-SQL
      ALTER TABLE portfolio.guests
      DROP CONSTRAINT guests_pkey;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.guests
      DROP COLUMN id;
    SQL

    # Drop the unique index on user_id (it becomes the PK)
    run <<-SQL
      DROP INDEX IF EXISTS portfolio.portfolio_guests_user_id_index;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.guests
      ADD CONSTRAINT guests_pkey PRIMARY KEY (user_id);
    SQL

    # =========================================================================
    # PHASE 4: Re-establish FK constraints for same-schema (portfolio) tables
    # =========================================================================
    run <<-SQL
      ALTER TABLE portfolio.cast_areas
      ADD CONSTRAINT cast_areas_cast_user_id_fkey
      FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_genres
      ADD CONSTRAINT cast_genres_cast_user_id_fkey
      FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
    SQL

    run <<-SQL
      ALTER TABLE portfolio.cast_gallery_media
      ADD CONSTRAINT cast_gallery_media_cast_user_id_fkey
      FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
    SQL
  end

  down do
    raise "This migration is not reversible. Restore from backup."
  end
end
