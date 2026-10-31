# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) do
      add_column :pinned_at, :timestamptz
      add_index :author_profile_id, unique: true, where: Sequel.~(pinned_at: nil), name: :idx_post_posts_pinned_author_profile_id
    end
  end

  down do
    alter_table(:post__posts) do
      drop_index :author_profile_id, name: :idx_post_posts_pinned_author_profile_id
      drop_column :pinned_at
    end
  end
end
