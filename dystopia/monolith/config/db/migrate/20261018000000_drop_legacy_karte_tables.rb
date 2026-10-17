# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"karte__reports"
    drop_table :"karte__entries"
    drop_table :"karte__access"
  end

  down do
    raise Sequel::Error, "irreversible: legacy karte entries, reports and access grants are not restored"
  end
end
