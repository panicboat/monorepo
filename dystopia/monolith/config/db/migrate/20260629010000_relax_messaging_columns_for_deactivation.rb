# frozen_string_literal: true

# Allow null participants so deactivation can preserve conversation history for the remaining participant.
ROM::SQL.migration do
  up do
    alter_table :messaging__messages do
      set_column_allow_null :sender_id
    end
    alter_table :messaging__threads do
      set_column_allow_null :account_a
      set_column_allow_null :account_b
    end
  end

  down do
    alter_table :messaging__messages do
      set_column_not_null :sender_id
    end
    alter_table :messaging__threads do
      set_column_not_null :account_a
      set_column_not_null :account_b
    end
  end
end
