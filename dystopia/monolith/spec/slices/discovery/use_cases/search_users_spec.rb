# frozen_string_literal: true

require "spec_helper"

RSpec.describe Discovery::UseCases::SearchUsers do
  subject(:use_case) { Discovery::Slice["use_cases.search_users"] }

  it "encodes the last profile id and continues without repeating a profile" do
    candidates = 3.times.map do |index|
      create_account_with_profile(
        display_name: "Cursor target #{index}",
        username: "cursor_target_#{index}",
        created_at: Time.utc(2026, 10, 1) + index
      )
    end

    first_page = use_case.call(query: "cursor_target", limit: 2)
    last_profile = first_page[:profiles].last
    decoded_cursor = use_case.send(:decode_cursor, first_page[:next_cursor])
    second_page = use_case.call(query: "cursor_target", limit: 2, cursor: first_page[:next_cursor])

    expect(decoded_cursor[:id]).to eq(last_profile.id)
    expect(decoded_cursor[:id]).not_to eq(last_profile.account_id)
    expect((first_page[:profiles].map(&:id) & second_page[:profiles].map(&:id))).to be_empty
    expect((first_page[:profiles].map(&:id) + second_page[:profiles].map(&:id)).sort).to eq(candidates.sort)
  end
end
