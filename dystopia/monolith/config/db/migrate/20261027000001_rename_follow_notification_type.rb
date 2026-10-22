# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "UPDATE notifications.notifications SET type = 'follow' WHERE type = 'follow_approved'"
  end

  down do
    run "UPDATE notifications.notifications SET type = 'follow_approved' WHERE type = 'follow'"
  end
end
