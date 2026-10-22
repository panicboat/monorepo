# frozen_string_literal: true

require "spec_helper"

RSpec.describe Discovery::UseCases::SearchSchedules, type: :database do
  subject(:use_case) { Discovery::Slice["use_cases.search_schedules"] }

  let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  let(:work_date) { "2026-10-22" }
  let!(:viewer) { create_account_with_profile(username: "schedule_viewer") }

  def cast(**attrs)
    create_account_with_profile(role: 2, username: "c#{SecureRandom.hex(8)}", **attrs)
  end

  def schedule(profile, start_time: "20:00", end_time: "02:00", date: work_date)
    schedule_repo.upsert(profile_id: profile, work_date: date, start_time: start_time, end_time: end_time)
  end

  def announce(profile, row, content: "see you", **post_attrs)
    post = post_repo.create_post({ author_profile_id: profile, content: content, visibility: "public", published_at: Time.now - 60, expires_at: Time.now + 3600 }.merge(post_attrs))
    schedule_repo.set_post_id(id: row[:id], post_id: post.id)
    post
  end

  def search(viewer_profile_id: viewer, **options)
    use_case.call(viewer_profile_id: viewer_profile_id, work_date: work_date, **options)
  end

  def profile_ids(result)
    result[:results].map { |entry| entry.summary.profile_id }
  end

  it "returns each cast's schedule with the summary, the prefecture, the area and an empty note" do
    suzu = cast(display_name: "Suzu", prefecture: "東京都", area: "新宿")
    schedule(suzu, start_time: "16:00")

    entry = search[:results].first

    expect(entry.schedule).to include(profile_id: suzu, work_date: Date.new(2026, 10, 22), start_time: "16:00", end_time: "02:00")
    expect(entry.summary).to have_attributes(profile_id: suzu, display_name: "Suzu", role: 2)
    expect(entry.prefecture).to eq("東京都")
    expect(entry.area).to eq("新宿")
    expect(entry.note).to eq("")
  end

  it "returns the industry of the cast" do
    suzu = cast
    Hanami.app["db.gateway"].connection[:profile__casts].insert(profile_id: suzu, industry: "fuzoku")
    schedule(suzu)

    expect(search[:results].first.summary.industry).to eq("fuzoku")
  end

  it "includes a private cast but not a guest, a disabled cast or a schedule on another date" do
    private_cast = cast(is_private: true)
    guest = create_account_with_profile(role: 1)
    disabled = cast(disabled_at: Time.now)
    other_day = cast
    [private_cast, guest, disabled].each { |profile| schedule(profile) }
    schedule(other_day, date: "2026-10-23")

    expect(profile_ids(search)).to eq([private_cast])
  end

  it "leaves out profiles blocked in either direction" do
    visible = cast
    blocked_by_viewer = cast
    blocking_viewer = cast
    [visible, blocked_by_viewer, blocking_viewer].each { |profile| schedule(profile) }
    block_repo.block(blocker_profile_id: viewer, blocked_profile_id: blocked_by_viewer)
    block_repo.block(blocker_profile_id: blocking_viewer, blocked_profile_id: viewer)

    expect(profile_ids(search)).to eq([visible])
  end

  it "limits following_only to approved follows" do
    approved = cast
    pending = cast
    stranger = cast
    [approved, pending, stranger].each { |profile| schedule(profile) }
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: approved, status: "approved")
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: pending, status: "pending")

    expect(profile_ids(search(following_only: true))).to eq([approved])
    expect(profile_ids(search(following_only: false))).to contain_exactly(approved, pending, stranger)
  end

  it "narrows by prefecture and by name" do
    tokyo = cast(display_name: "Suzu", prefecture: "東京都")
    osaka = cast(display_name: "Suzuka", prefecture: "大阪府")
    other = cast(display_name: "Mei", prefecture: "東京都")
    [tokyo, osaka, other].each { |profile| schedule(profile) }

    expect(profile_ids(search(prefecture: "東京都"))).to contain_exactly(tokyo, other)
    expect(profile_ids(search(query: "SUZU"))).to contain_exactly(tokyo, osaka)
    expect(profile_ids(search(prefecture: "東京都", query: "suzu"))).to eq([tokyo])
  end

  it "narrows by area and by industry" do
    shinjuku_soap = cast(prefecture: "東京都", area: "新宿")
    shinjuku_delivery = cast(prefecture: "東京都", area: "新宿")
    ikebukuro_soap = cast(prefecture: "東京都", area: "池袋")
    db = Hanami.app["db.gateway"].connection
    db[:profile__casts].insert(profile_id: shinjuku_soap, industry: "ソープ")
    db[:profile__casts].insert(profile_id: shinjuku_delivery, industry: "デリヘル")
    db[:profile__casts].insert(profile_id: ikebukuro_soap, industry: "ソープ")
    [shinjuku_soap, shinjuku_delivery, ikebukuro_soap].each { |profile| schedule(profile) }

    expect(profile_ids(search(prefecture: "東京都", area: "新宿"))).to contain_exactly(shinjuku_soap, shinjuku_delivery)
    expect(profile_ids(search(industry: "ソープ"))).to contain_exactly(shinjuku_soap, ikebukuro_soap)
    expect(profile_ids(search(prefecture: "東京都", area: "新宿", industry: "ソープ"))).to eq([shinjuku_soap])
  end

  it "ignores a leading @ in the name, as the card shows the username" do
    suzu = cast(display_name: "Sora", username: "suzu_21")
    cast_without_match = cast(display_name: "Mei")
    [suzu, cast_without_match].each { |profile| schedule(profile) }

    expect(profile_ids(search(query: "@suzu"))).to eq([suzu])
    expect(profile_ids(search(query: "＠suzu"))).to eq([suzu])
    expect(profile_ids(search(query: "  @suzu_21 "))).to eq([suzu])
    expect(profile_ids(search(query: "@"))).to contain_exactly(suzu, cast_without_match)
  end

  it "narrows by the hours worked" do
    day = cast
    late = cast
    night = cast
    schedule(day, start_time: "12:00", end_time: "17:00")
    schedule(late, start_time: "16:00", end_time: "22:00")
    schedule(night, start_time: "23:00", end_time: "02:00")

    expect(profile_ids(search(time_band: "day"))).to contain_exactly(day, late)
    expect(profile_ids(search(time_band: "evening"))).to eq([late])
    expect(profile_ids(search(time_band: "night"))).to contain_exactly(late, night)
    expect(profile_ids(search(time_band: ""))).to contain_exactly(day, late, night)
  end

  describe "note" do
    it "carries the content of a showing announcement" do
      suzu = cast
      announce(suzu, schedule(suzu), content: "久しぶりにお店にいます")

      expect(search[:results].first.note).to eq("久しぶりにお店にいます")
    end

    it "is empty when the schedule has no announcement" do
      schedule(cast)

      expect(search[:results].first.note).to eq("")
    end

    it "is empty while the announcement is scheduled or after it stopped showing" do
      upcoming = cast
      ended = cast
      announce(upcoming, schedule(upcoming), content: "upcoming", published_at: Time.now + 3600, expires_at: Time.now + 7200)
      announce(ended, schedule(ended), content: "ended", published_at: Time.now - 7200, expires_at: Time.now - 3600)

      expect(search[:results].map(&:note)).to eq(["", ""])
    end

    it "is empty for a followers-only announcement unless the viewer is an approved follower" do
      suzu = cast
      announce(suzu, schedule(suzu), content: "followers only", visibility: "private")
      pending_viewer = create_account_with_profile
      follower = create_account_with_profile
      follow_repo.follow(follower_profile_id: pending_viewer, followee_profile_id: suzu, status: "pending")
      follow_repo.follow(follower_profile_id: follower, followee_profile_id: suzu, status: "approved")

      expect(search[:results].map(&:note)).to eq([""])
      expect(search(viewer_profile_id: pending_viewer)[:results].map(&:note)).to eq([""])
      expect(search(viewer_profile_id: follower)[:results].map(&:note)).to eq(["followers only"])
    end

    it "is empty for a private cast's announcement unless the viewer is an approved follower" do
      suzu = cast(is_private: true)
      announce(suzu, schedule(suzu), content: "private cast")
      follower = create_account_with_profile
      follow_repo.follow(follower_profile_id: follower, followee_profile_id: suzu, status: "approved")

      expect(search[:results].map(&:note)).to eq([""])
      expect(search(viewer_profile_id: follower)[:results].map(&:note)).to eq(["private cast"])
    end

    it "loads the announcement posts of a page in one lookup" do
      3.times do
        profile = cast
        announce(profile, schedule(profile))
      end

      expect_any_instance_of(Post::Repositories::PostRepository).to receive(:find_by_ids).once.and_call_original

      expect(search[:results].map(&:note)).to eq(["see you"] * 3)
    end
  end

  describe "paging" do
    def seed(start_times)
      start_times.to_h { |start_time| [start_time, cast.tap { |profile| schedule(profile, start_time: start_time) }] }
    end

    it "orders the small hours after the evening and continues by cursor without repeats or gaps" do
      profiles = seed(%w[22:00 23:30 00:30 04:00])
      ordered = %w[22:00 23:30 00:30 04:00].map { |start_time| profiles[start_time] }

      first = search(limit: 2)
      second = search(limit: 2, cursor: first[:next_cursor])

      expect(profile_ids(first)).to eq(ordered.first(2))
      expect(first[:has_more]).to be(true)
      expect(profile_ids(second)).to eq(ordered.last(2))
      expect(second[:has_more]).to be(false)
      expect(second[:next_cursor]).to be_nil
    end

    it "continues after a page that ends on a shared start time" do
      profiles = Array.new(3) { cast.tap { |profile| schedule(profile, start_time: "22:00") } }.sort

      first = search(limit: 2)
      second = search(limit: 2, cursor: first[:next_cursor])

      expect(profile_ids(first) + profile_ids(second)).to eq(profiles)
    end

    it "starts from the first page for a cursor it cannot read" do
      profile = cast
      schedule(profile)

      expect(profile_ids(search(cursor: "garbage"))).to eq([profile])
      expect(profile_ids(search(cursor: use_case.send(:encode_cursor, other: "x")))).to eq([profile])
    end
  end

  describe "validation" do
    ["2026-13-45", "2026-02-30", "", "2026-1-1", "tomorrow", nil].each do |value|
      it "rejects the work date #{value.inspect}" do
        expect { use_case.call(viewer_profile_id: viewer, work_date: value) }.to raise_error(Errors::ValidationError)
      end
    end

    it "rejects an unknown time band" do
      expect { search(time_band: "noon") }.to raise_error(Errors::ValidationError)
    end
  end
end
