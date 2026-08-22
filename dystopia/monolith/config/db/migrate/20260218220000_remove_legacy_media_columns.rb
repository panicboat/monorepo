# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Remove legacy columns from post__post_media
    alter_table :"post__post_media" do
      drop_column :url
      drop_column :thumbnail_url
    end

    # Remove legacy columns from post__comment_media
    alter_table :"post__comment_media" do
      drop_column :url
      drop_column :thumbnail_url
    end

    # Remove legacy columns from portfolio__casts
    alter_table :"portfolio__casts" do
      drop_column :image_path
      drop_column :avatar_path
      drop_column :images
    end

    # Remove legacy columns from portfolio__guests
    alter_table :"portfolio__guests" do
      drop_column :avatar_path
    end
  end

  down do
    # Restore legacy columns to post__post_media
    alter_table :"post__post_media" do
      add_column :url, String
      add_column :thumbnail_url, String
    end

    # Restore legacy columns to post__comment_media
    alter_table :"post__comment_media" do
      add_column :url, String
      add_column :thumbnail_url, String
    end

    # Restore legacy columns to portfolio__casts
    alter_table :"portfolio__casts" do
      add_column :image_path, String
      add_column :avatar_path, String
      add_column :images, "text[]"
    end

    # Restore legacy columns to portfolio__guests
    alter_table :"portfolio__guests" do
      add_column :avatar_path, String
    end
  end
end
