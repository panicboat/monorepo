# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::ListAreas", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.list_areas"] }
  let(:areas) { Hanami.app.slices[:profile]["relations.areas"] }

  before do
    areas.changeset(:create, id: SecureRandom.uuid_v7, prefecture: "東京都", name: "渋谷", code: "shibuya_t", region: "関東", sort_order: 1, active: true).commit
    areas.changeset(:create, id: SecureRandom.uuid_v7, prefecture: "大阪府", name: "難波", code: "namba_t", region: "関西", sort_order: 2, active: true).commit
  end

  it "lists all active areas" do
    expect(uc.call.map(&:code)).to include("shibuya_t", "namba_t")
  end

  it "filters by prefecture" do
    result = uc.call(prefecture: "大阪府")
    expect(result.map(&:code)).to include("namba_t")
    expect(result.map(&:prefecture).uniq).to eq(["大阪府"])
  end
end
