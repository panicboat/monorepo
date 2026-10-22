# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) do
      add_column :published_at, :timestamptz, null: false, default: Sequel.lit("now()")
      add_column :expires_at, :timestamptz, null: true
    end
    run "UPDATE post.posts SET published_at = created_at"
    run <<~SQL
      ALTER TABLE post.posts
        ADD CONSTRAINT post_posts_expires_after_published
        CHECK (expires_at IS NULL OR expires_at > published_at)
    SQL
    run <<~SQL
      CREATE INDEX idx_post_posts_published
        ON post.posts (published_at DESC, id DESC)
    SQL
  end

  down do
    run "DROP INDEX post.idx_post_posts_published"
    run "ALTER TABLE post.posts DROP CONSTRAINT post_posts_expires_after_published"
    alter_table(:post__posts) do
      drop_column :expires_at
      drop_column :published_at
    end
  end
end
