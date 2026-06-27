# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :identity__sms_verifications do
      add_column :consumed_at, DateTime
      add_column :failed_attempts, Integer, null: false, default: 0
    end
  end
end
