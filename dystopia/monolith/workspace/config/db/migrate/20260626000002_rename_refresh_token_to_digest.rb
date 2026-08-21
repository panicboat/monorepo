# frozen_string_literal: true

# Pre-prod migration: drop the plaintext `token` column and replace it with
# `token_digest` (SHA256). Existing rows would not satisfy the new digest
# semantics, so they are truncated — affected sessions re-login.
ROM::SQL.migration do
  up do
    from(:identity__refresh_tokens).delete
    alter_table :identity__refresh_tokens do
      drop_column :token
      add_column :token_digest, String, null: false
      add_index :token_digest, unique: true
    end
  end

  down do
    alter_table :identity__refresh_tokens do
      drop_index :token_digest
      drop_column :token_digest
      add_column :token, String, null: false
      add_index :token, unique: true
    end
  end
end
