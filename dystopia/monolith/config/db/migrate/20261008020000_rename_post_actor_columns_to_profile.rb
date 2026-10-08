# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) { rename_column :author_id, :author_profile_id }
    alter_table(:post__comments) { rename_column :user_id, :author_profile_id }
    alter_table(:post__likes) { rename_column :account_id, :profile_id }
    alter_table(:post__post_mentions) { rename_column :account_id, :profile_id }
    alter_table(:post__comment_mentions) { rename_column :account_id, :profile_id }

    run "ALTER INDEX post.social_post_comments_user_id_index RENAME TO social_post_comments_author_profile_id_index"
    run "ALTER INDEX post.idx_post_likes_post_account RENAME TO idx_post_likes_post_profile"
    run "ALTER INDEX post.post_post_mentions_account_id_index RENAME TO post_post_mentions_profile_id_index"
    run "ALTER INDEX post.post_comment_mentions_account_id_index RENAME TO post_comment_mentions_profile_id_index"

    run "ALTER TABLE post.comments RENAME CONSTRAINT post_comments_user_id_not_null TO post_comments_author_profile_id_not_null"
    run "ALTER TABLE post.post_mentions RENAME CONSTRAINT post_mentions_account_id_not_null TO post_mentions_profile_id_not_null"
    run "ALTER TABLE post.comment_mentions RENAME CONSTRAINT comment_mentions_account_id_not_null TO comment_mentions_profile_id_not_null"
  end

  down do
    run "ALTER TABLE post.comment_mentions RENAME CONSTRAINT comment_mentions_profile_id_not_null TO comment_mentions_account_id_not_null"
    run "ALTER TABLE post.post_mentions RENAME CONSTRAINT post_mentions_profile_id_not_null TO post_mentions_account_id_not_null"
    run "ALTER TABLE post.comments RENAME CONSTRAINT post_comments_author_profile_id_not_null TO post_comments_user_id_not_null"

    run "ALTER INDEX post.post_comment_mentions_profile_id_index RENAME TO post_comment_mentions_account_id_index"
    run "ALTER INDEX post.post_post_mentions_profile_id_index RENAME TO post_post_mentions_account_id_index"
    run "ALTER INDEX post.idx_post_likes_post_profile RENAME TO idx_post_likes_post_account"
    run "ALTER INDEX post.social_post_comments_author_profile_id_index RENAME TO social_post_comments_user_id_index"

    alter_table(:post__comment_mentions) { rename_column :profile_id, :account_id }
    alter_table(:post__post_mentions) { rename_column :profile_id, :account_id }
    alter_table(:post__likes) { rename_column :profile_id, :account_id }
    alter_table(:post__comments) { rename_column :author_profile_id, :user_id }
    alter_table(:post__posts) { rename_column :author_profile_id, :author_id }
  end
end
