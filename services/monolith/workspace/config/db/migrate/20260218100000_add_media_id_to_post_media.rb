# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Add media_id column to post__post_media and make url nullable
    # NOTE: No foreign key to media__files (cross-slice soft reference)
    alter_table :"post__post_media" do
      add_column :media_id, :uuid
      add_index :media_id
      set_column_allow_null :url
    end

    # Add media_id column to post__comment_media and make url nullable
    # NOTE: No foreign key to media__files (cross-slice soft reference)
    alter_table :"post__comment_media" do
      add_column :media_id, :uuid
      add_index :media_id
      set_column_allow_null :url
    end
  end

  down do
    alter_table :"post__comment_media" do
      drop_index :media_id
      drop_column :media_id
      set_column_not_null :url
    end

    alter_table :"post__post_media" do
      drop_index :media_id
      drop_column :media_id
      set_column_not_null :url
    end
  end
end
