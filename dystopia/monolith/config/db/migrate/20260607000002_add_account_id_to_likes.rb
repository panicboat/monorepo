# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__likes) do
      add_column :account_id, :uuid
    end
    run "UPDATE post.likes SET account_id = guest_user_id WHERE account_id IS NULL"
    alter_table(:post__likes) do
      set_column_allow_null :guest_user_id
    end
    add_index :post__likes, [:post_id, :account_id],
      unique: true, name: :idx_post_likes_post_account,
      where: Sequel.lit("account_id IS NOT NULL")
  end

  down do
    drop_index :post__likes, [:post_id, :account_id], name: :idx_post_likes_post_account
    alter_table(:post__likes) do
      set_column_not_null :guest_user_id
      drop_column :account_id
    end
  end
end
