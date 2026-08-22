# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # 1. Create new schemas
    run "CREATE SCHEMA IF NOT EXISTS media"
    run "CREATE SCHEMA IF NOT EXISTS post"
    run "CREATE SCHEMA IF NOT EXISTS relationship"

    # 2. Move relationship tables (no FK dependencies)
    run "ALTER TABLE social.cast_follows SET SCHEMA relationship"
    run "ALTER TABLE relationship.cast_follows RENAME TO follows"

    run "ALTER TABLE social.blocks SET SCHEMA relationship"
    # blocks stays as-is (no prefix to remove)

    run "ALTER TABLE social.cast_favorites SET SCHEMA relationship"
    run "ALTER TABLE relationship.cast_favorites RENAME TO favorites"

    # 3. Move post tables (order matters due to FK constraints)
    # First move the parent table (cast_posts)
    run "ALTER TABLE social.cast_posts SET SCHEMA post"
    run "ALTER TABLE post.cast_posts RENAME TO posts"

    # Then move child tables
    run "ALTER TABLE social.cast_post_hashtags SET SCHEMA post"
    run "ALTER TABLE post.cast_post_hashtags RENAME TO hashtags"

    run "ALTER TABLE social.post_likes SET SCHEMA post"
    run "ALTER TABLE post.post_likes RENAME TO likes"

    run "ALTER TABLE social.post_comments SET SCHEMA post"
    run "ALTER TABLE post.post_comments RENAME TO comments"

    # Move media tables (keep structure, just rename)
    run "ALTER TABLE social.cast_post_media SET SCHEMA post"
    run "ALTER TABLE post.cast_post_media RENAME TO post_media"

    run "ALTER TABLE social.comment_media SET SCHEMA post"
    # comment_media stays as-is (no prefix to remove)
  end

  down do
    # Reverse: Move tables back to social schema
    run "ALTER TABLE post.comment_media SET SCHEMA social"

    run "ALTER TABLE post.post_media RENAME TO cast_post_media"
    run "ALTER TABLE post.cast_post_media SET SCHEMA social"

    run "ALTER TABLE post.comments RENAME TO post_comments"
    run "ALTER TABLE post.post_comments SET SCHEMA social"

    run "ALTER TABLE post.likes RENAME TO post_likes"
    run "ALTER TABLE post.post_likes SET SCHEMA social"

    run "ALTER TABLE post.hashtags RENAME TO cast_post_hashtags"
    run "ALTER TABLE post.cast_post_hashtags SET SCHEMA social"

    run "ALTER TABLE post.posts RENAME TO cast_posts"
    run "ALTER TABLE post.cast_posts SET SCHEMA social"

    run "ALTER TABLE relationship.favorites RENAME TO cast_favorites"
    run "ALTER TABLE relationship.cast_favorites SET SCHEMA social"

    run "ALTER TABLE relationship.blocks SET SCHEMA social"

    run "ALTER TABLE relationship.follows RENAME TO cast_follows"
    run "ALTER TABLE relationship.cast_follows SET SCHEMA social"

    run "DROP SCHEMA IF EXISTS relationship"
    run "DROP SCHEMA IF EXISTS post"
    run "DROP SCHEMA IF EXISTS media"
  end
end
