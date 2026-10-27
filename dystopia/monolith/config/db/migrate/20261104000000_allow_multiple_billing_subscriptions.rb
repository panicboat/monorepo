# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:billing__subscriptions) do
      drop_constraint :uq_billing_subscriptions_account_id
      add_index :account_id, name: :idx_billing_subscriptions_account_id
    end
  end

  down do
    alter_table(:billing__subscriptions) do
      drop_index :account_id, name: :idx_billing_subscriptions_account_id
      add_unique_constraint [:account_id], name: :uq_billing_subscriptions_account_id
    end
  end
end
