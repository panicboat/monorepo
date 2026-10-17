# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"review__cast_settings"
    drop_table :"review__entries"
  end

  down do
    raise Sequel::Error, "irreversible: legacy review entries and cast settings are not restored"
  end
end
