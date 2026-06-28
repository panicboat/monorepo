# frozen_string_literal: true

# Allow sender_id and threads.account_a / account_b to be NULL so that
# hard-delete of a Cast can preserve the conversation history for the
# remaining participant (mainstream messaging UX: "(retired)" sender).
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
