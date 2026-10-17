# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Karte list use cases", type: :database do
  def uc(name) = Karte::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:cast_account) { create_account(role: 2) }
  let(:persona) { create_account_with_profile(account_id: cast_account, username: "persona") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:event_input) { { stage: "service", outcome: "completed", tags: [], note: "", occurred_on: "2026-10-01" } }

  def write(account:, profile:, rating:, close: false, created_at: Time.now)
    karte = uc(:create_karte).call(viewer_account_id: account, viewer_profile_id: profile, target_profile_id: guest, rating: rating, event: event_input)
    uc(:close_karte).call(viewer_account_id: account, karte_id: karte[:id]) if close
    db[:karte__kartes].where(id: karte[:id]).update(created_at: created_at)
    karte
  end

  it "lists a guest's kartes with the reliability of the closed ones" do
    now = Time.now
    first = write(account: cast_account, profile: persona, rating: 5, close: true, created_at: now - 30)
    second = write(account: other_cast_account, profile: other_persona, rating: 3, close: true, created_at: now - 20)
    open_one = write(account: cast_account, profile: persona, rating: nil, created_at: now - 10)

    result = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to eq([open_one[:id], second[:id], first[:id]])
    expect(result[:kartes].first[:events].length).to eq(1)
    expect(result[:reliability]).to eq(average_rating: 4.0, rater_count: 2, karte_count: 2)
    expect(result[:has_more]).to be false
    expect(result[:next_cursor]).to be_nil
  end

  it "pages with a cursor" do
    now = Time.now
    older = write(account: cast_account, profile: persona, rating: nil, created_at: now - 20)
    newer = write(account: cast_account, profile: persona, rating: nil, created_at: now - 10)

    page = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 1, cursor: nil)
    expect(page[:kartes].map { |k| k[:id] }).to eq([newer[:id]])
    expect(page[:has_more]).to be true

    rest = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 1, cursor: page[:next_cursor])
    expect(rest[:kartes].map { |k| k[:id] }).to eq([older[:id]])
    expect(rest[:has_more]).to be false
  end

  it "uses 20 for a missing limit and 50 at most" do
    page = Karte::Slice["use_cases.page_kartes"]

    expect(page.limit_for(0)).to eq(20)
    expect(page.limit_for(-3)).to eq(20)
    expect(page.limit_for(7)).to eq(7)
    expect(page.limit_for(500)).to eq(50)
  end

  it "lists the viewer's own kartes across the account's profiles" do
    second_persona = create_account_with_profile(account_id: cast_account, username: "persona_two")
    mine = write(account: cast_account, profile: persona, rating: nil)
    also_mine = write(account: cast_account, profile: second_persona, rating: nil)
    write(account: other_cast_account, profile: other_persona, rating: nil)

    result = uc(:list_my_kartes).call(viewer_account_id: cast_account, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to contain_exactly(mine[:id], also_mine[:id])
  end

  it "lists recent kartes of every cast, open ones included" do
    open_karte = write(account: cast_account, profile: persona, rating: nil)
    closed_karte = write(account: other_cast_account, profile: other_persona, rating: 2, close: true)

    result = uc(:list_recent_kartes).call(viewer_account_id: other_cast_account, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to contain_exactly(open_karte[:id], closed_karte[:id])
  end

  it "refuses a guest viewer and a malformed target id" do
    expect { uc(:list_recent_kartes).call(viewer_account_id: guest_account, limit: 20, cursor: nil) }.to raise_error(Karte::Errors::Forbidden)
    expect { uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: "abc", limit: 20, cursor: nil) }
      .to raise_error(Karte::Errors::Invalid, "Unknown profile")
  end
end
