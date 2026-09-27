# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"post__post_media" do
      drop_column :url
      drop_column :thumbnail_url
    end

    alter_table :"post__comment_media" do
      drop_column :url
      drop_column :thumbnail_url
    end

    alter_table :"portfolio__casts" do
      drop_column :image_path
      drop_column :avatar_path
      drop_column :images
    end

    alter_table :"portfolio__guests" do
      drop_column :avatar_path
    end
  end

  down do
    alter_table :"post__post_media" do
      add_column :url, String
      add_column :thumbnail_url, String
    end

    alter_table :"post__comment_media" do
      add_column :url, String
      add_column :thumbnail_url, String
    end

    alter_table :"portfolio__casts" do
      add_column :image_path, String
      add_column :avatar_path, String
      add_column :images, "text[]"
    end

    alter_table :"portfolio__guests" do
      add_column :avatar_path, String
    end
  end
end
