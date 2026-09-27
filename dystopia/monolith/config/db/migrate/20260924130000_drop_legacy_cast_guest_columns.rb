# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"post__posts" do
      drop_column :cast_user_id
    end

    alter_table :"post__likes" do
      drop_column :guest_user_id
    end
  end

  down do
    alter_table :"post__posts" do
      add_column :cast_user_id, :uuid
    end
    add_index :"post__posts", :cast_user_id, name: :post_posts_cast_user_id_index

    alter_table :"post__likes" do
      add_column :guest_user_id, :uuid
    end
    add_index :"post__likes", :guest_user_id, name: :post_likes_guest_user_id_index
    add_index :"post__likes", [:post_id, :guest_user_id], name: :post_likes_post_id_guest_user_id_key, unique: true
  end
end
