# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review::Relations::Entries", type: :database do
  let(:relation) { Hanami.app.slices[:review]["relations.entry_records"] }

  it "maps to review__entries with the expected schema" do
    expect(relation.name.dataset).to eq(:"review__entries")
    expect(relation.schema.primary_key_name).to eq(:id)
    expect(relation.schema.attributes.map(&:name)).to contain_exactly(
      :id, :author_account_id, :target_account_id, :rating, :body, :hidden,
      :created_at, :updated_at
    )
  end
end

RSpec.describe "Review::Relations::CastSettings", type: :database do
  let(:relation) { Hanami.app.slices[:review]["relations.cast_settings_records"] }

  it "maps to review__cast_settings with the expected schema" do
    expect(relation.name.dataset).to eq(:"review__cast_settings")
    expect(relation.schema.primary_key_name).to eq(:account_id)
    expect(relation.schema.attributes.map(&:name)).to contain_exactly(
      :account_id, :reviews_visible, :updated_at
    )
  end
end
