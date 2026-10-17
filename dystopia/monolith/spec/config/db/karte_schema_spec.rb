# frozen_string_literal: true

RSpec.describe "karte schema" do
  let(:db) { Hanami.app["db.gateway"].connection }

  it "holds only the karte lifecycle tables" do
    tables = db[Sequel[:information_schema][:tables]].where(table_schema: "karte").select_map(:table_name).sort

    expect(tables).to eq(%w[events kartes])
  end
end
