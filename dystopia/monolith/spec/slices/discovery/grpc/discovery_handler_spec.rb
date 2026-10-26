# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/discovery/grpc/discovery_handler"

RSpec.describe Discovery::Grpc::DiscoveryHandler, type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }

  let!(:viewer) { create_account_with_profile(username: "discovery_viewer") }
  let!(:other_guest) { create_account_with_profile(username: "discovery_other_guest") }
  let!(:public_cast) { create_account_with_profile(role: 2, username: "discovery_public") }
  let!(:locked_cast) { create_account_with_profile(role: 2, username: "discovery_private", is_private: true) }
  let!(:public_post) { post_repo.create_post(author_profile_id: public_cast, content: "discovery public", visibility: "public") }
  let!(:locked_post) { post_repo.create_post(author_profile_id: locked_cast, content: "discovery locked", visibility: "public") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def suggested
    rpc(:suggest_users, Discovery::V1::SuggestUsersRequest.new).profiles.map { |p| [p.profile_id, p.role] }
  end

  def searched_post_ids
    rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "discovery")).posts.map(&:id)
  end

  def liked(post)
    like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7)
    post
  end

  def ranked_post_ids
    rpc(:rank_posts, Discovery::V1::RankPostsRequest.new(period: :RANK_PERIOD_ALL)).posts.map(&:id)
  end

  after { Current.clear }

  it "suggests profiles of the opposite role, without the ones the acting profile follows or is blocked with" do
    act_as(viewer)
    expect(suggested).to contain_exactly([public_cast, 2], [locked_cast, 2])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
    block_repo.block(blocker_profile_id: locked_cast, blocked_profile_id: viewer)
    expect(suggested).to be_empty

    act_as(public_cast)
    expect(suggested).to contain_exactly([viewer, 1], [other_guest, 1])
  end

  it "searches by tag when the query starts with a number sign, and by content otherwise" do
    tagged = post_repo.create_post(author_profile_id: public_cast, content: "new arrivals #spring", visibility: "public")
    post_repo.save_hashtags(post_id: tagged.id, hashtags: ["spring"])
    longer = post_repo.create_post(author_profile_id: public_cast, content: "sale #springsale", visibility: "public")
    post_repo.save_hashtags(post_id: longer.id, hashtags: ["springsale"])
    search = ->(query) { rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: query)).posts.map(&:id) }

    act_as(viewer)

    expect(search.call("#spring")).to eq([tagged.id])
    expect(search.call("＃Spring")).to eq([tagged.id])
    expect(search.call("spring")).to contain_exactly(tagged.id, longer.id)
    expect(rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "#spring")).posts.first.hashtags).to eq(["spring"])
  end

  it "pages search results by the display start" do
    now = Time.now
    started = post_repo.create_post(author_profile_id: public_cast, content: "paged started", visibility: "public", published_at: now - 60, created_at: now - 86_400)
    older = Array.new(2) { |i| post_repo.create_post(author_profile_id: public_cast, content: "paged older", visibility: "public", published_at: now - (3600 * (i + 1))) }
    act_as(viewer)

    first = rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "paged", limit: 2))
    second = rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "paged", limit: 2, cursor: first.next_cursor))

    expect(first.posts.map(&:id) + second.posts.map(&:id)).to eq([started.id, *older.map(&:id)])
    expect(second.has_more).to be(false)
  end

  it "searches and ranks a locked profile's public posts like any other public post" do
    [public_post, locked_post].each { |post| liked(post) }
    act_as(viewer)
    expect(searched_post_ids).to contain_exactly(public_post.id, locked_post.id)
    expect(ranked_post_ids).to contain_exactly(public_post.id, locked_post.id)
  end

  it "keeps followers-only posts out of search and ranking, even for an approved follower" do
    [public_post, post_repo.create_post(author_profile_id: public_cast, content: "discovery followers", visibility: "private")].each { |post| liked(post) }
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
    act_as(viewer)

    expect(searched_post_ids).to contain_exactly(public_post.id, locked_post.id)
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "keeps scheduled and expired posts out of search and ranking" do
    now = Time.now
    liked(public_post)
    liked(post_repo.create_post(author_profile_id: public_cast, content: "discovery scheduled", visibility: "public", published_at: now + 3600))
    liked(post_repo.create_post(author_profile_id: public_cast, content: "discovery expired", visibility: "public", published_at: now - 7200, expires_at: now - 3600))
    act_as(public_cast)

    expect(searched_post_ids).to contain_exactly(public_post.id, locked_post.id)
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "returns each found profile with the role of its account" do
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_p")).profiles

    expect(found.map { |p| [p.username, p.role] }).to contain_exactly(["discovery_public", 2], ["discovery_private", 2])
    expect(found).to all(be_a(::Profile::V1::ProfileSummary))
  end

  it "returns the avatar url of a found profile that has an icon" do
    media_id = SecureRandom.uuid_v7
    db = Hanami.app["db.gateway"].connection
    db[:profile__profiles].where(id: public_cast).update(avatar_media_id: media_id)
    file = Struct.new(:id, :url, :thumbnail_url, :media_type, :media_key, :thumbnail_key).new(media_id, "https://cdn.example/a.png", nil, "image", "k", nil)
    allow_any_instance_of(Media::UseCases::GetMediaBatch).to receive(:call).and_return([file])
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_public")).profiles

    expect(found.map(&:avatar_url)).to eq(["https://cdn.example/a.png"])
  end

  describe "search_schedules" do
    let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }

    def search_schedules(**attrs)
      rpc(:search_schedules, Discovery::V1::SearchSchedulesRequest.new(work_date: "2026-10-22", **attrs))
    end

    def status_of
      yield
      nil
    rescue GRPC::BadStatus => e
      e.code
    end

    def schedule(profile, start_time: "20:00")
      schedule_repo.upsert(profile_id: profile, work_date: "2026-10-22", start_time: start_time, end_time: "02:00")
    end

    it "returns the schedule, the profile summary, the prefecture, the area and the note of each cast" do
      db = Hanami.app["db.gateway"].connection
      db[:profile__profiles].where(id: public_cast).update(prefecture: "東京都", area: "新宿")
      db[:profile__casts].insert(profile_id: public_cast, industry: "fuzoku")
      row = schedule(public_cast, start_time: "16:00")
      announcement = post_repo.create_post(author_profile_id: public_cast, content: "hello", visibility: "public", published_at: Time.now - 60, expires_at: Time.now + 3600)
      schedule_repo.set_post_id(id: row[:id], post_id: announcement.id)
      act_as(viewer)

      result = search_schedules.results.first

      expect(result).to be_a(Discovery::V1::ScheduleSearchResult)
      expect(result.schedule).to eq(Schedule::V1::Schedule.new(profile_id: public_cast, work_date: "2026-10-22", start_time: "16:00", end_time: "02:00"))
      expect(result.profile).to have_attributes(profile_id: public_cast, username: "discovery_public", role: 2, industry: "fuzoku")
      expect(result.prefecture).to eq("東京都")
      expect(result.area).to eq("新宿")
      expect(result.note).to eq("hello")
      expect(search_schedules(prefecture: "東京都", area: "新宿", industry: "fuzoku").results.map { |entry| entry.profile.profile_id }).to eq([public_cast])
      expect(search_schedules(area: "池袋").results).to be_empty
      expect(search_schedules(industry: "ソープ").results).to be_empty
    end

    it "shows locked casts, hides the ones the acting profile is blocked with, and limits following_only to approved follows" do
      schedule(public_cast)
      schedule(locked_cast)
      act_as(viewer)

      expect(search_schedules.results.map { |r| r.profile.profile_id }).to contain_exactly(public_cast, locked_cast)

      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: locked_cast, status: "approved")
      expect(search_schedules(following_only: true).results.map { |r| r.profile.profile_id }).to eq([locked_cast])

      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: viewer)
      expect(search_schedules.results.map { |r| r.profile.profile_id }).to eq([locked_cast])
    end

    it "pages by cursor, 20 at a time by default" do
      Array.new(21) { |i| schedule(create_account_with_profile(role: 2, username: "paged_cast_#{i}"), start_time: format("%02d:00", i % 5 + 12)) }
      act_as(viewer)

      first = search_schedules
      second = search_schedules(cursor: first.next_cursor)

      expect(first.results.size).to eq(20)
      expect(first.has_more).to be(true)
      expect(second.results.size).to eq(1)
      expect(second.has_more).to be(false)
      expect(second.next_cursor).to eq("")
    end

    it "rejects a work date or time band that is not valid with INVALID_ARGUMENT" do
      act_as(viewer)

      expect(status_of { search_schedules(work_date: "2026-13-45") }).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(status_of { rpc(:search_schedules, Discovery::V1::SearchSchedulesRequest.new(work_date: "")) }).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(status_of { search_schedules(time_band: "noon") }).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "requires an authenticated profile" do
      expect(status_of { search_schedules }).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end
  end
end
