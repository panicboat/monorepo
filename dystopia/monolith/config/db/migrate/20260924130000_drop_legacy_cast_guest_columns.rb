# frozen_string_literal: true

# post.posts.cast_user_id and post.likes.guest_user_id predate the
# 2026-06-07 author_id/account_id migration (20260607000001/20260607000002)
# that unified post authorship across casts and guests. New rows have never
# written to either column since; only a handful of now-deleted repository
# methods still read them. Zero live callers as of the 2026-09-22 schema
# audit.
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
