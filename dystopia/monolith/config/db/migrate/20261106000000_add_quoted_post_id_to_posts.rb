# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) do
      add_column :quoted_post_id, :uuid
      add_index [:quoted_post_id, Sequel.desc(:published_at), Sequel.desc(:id)], where: Sequel.~(quoted_post_id: nil), name: :idx_post_posts_quoted_post_id
    end
  end

  down do
    alter_table(:post__posts) do
      drop_index :quoted_post_id, name: :idx_post_posts_quoted_post_id
      drop_column :quoted_post_id
    end
  end
end
