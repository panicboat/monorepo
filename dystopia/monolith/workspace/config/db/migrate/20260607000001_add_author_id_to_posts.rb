# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) do
      add_column :author_id, :uuid
    end
    run "UPDATE post.posts SET author_id = cast_user_id WHERE author_id IS NULL"
    alter_table(:post__posts) do
      set_column_allow_null :cast_user_id
    end
  end

  down do
    alter_table(:post__posts) do
      set_column_not_null :cast_user_id
      drop_column :author_id
    end
  end
end
