# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Make url column nullable (now using media_id instead)
    alter_table :"post__post_media" do
      set_column_allow_null :url
    end

    alter_table :"post__comment_media" do
      set_column_allow_null :url
    end
  end

  down do
    alter_table :"post__post_media" do
      set_column_not_null :url
    end

    alter_table :"post__comment_media" do
      set_column_not_null :url
    end
  end
end
