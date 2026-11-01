# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe "quoted post", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:media_repo) { Media::Slice["repositories.media_repository"] }
  let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }
  let(:list_posts_by_ids) { Post::Slice["use_cases.posts.list_posts_by_ids"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:now) { Time.now }
  let(:author) { create_account_with_profile(role: 2, username: "quote_author") }
  let(:quoter) { create_account_with_profile(username: "quote_quoter") }
  let(:viewer) { create_account_with_profile(username: "quote_viewer") }
  let!(:original) { post_repo.create_post(author_profile_id: author, content: "original words", visibility: "public", published_at: now - 3600) }

  after { Current.clear }

  def rpc(method, message)
    Post::Grpc::PostHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def quote_of(target, by: quoter, **attributes)
    post_repo.create_post(author_profile_id: by, content: "my take", visibility: "public", published_at: now - 60, quoted_post_id: target.id, **attributes)
  end

  def get_post(post, viewer:)
    act_as(viewer)
    rpc(:get_post, Post::V1::GetPostRequest.new(id: post.id)).post
  end

  def list_quotes(post, viewer:, **params)
    act_as(viewer)
    rpc(:list_post_quotes, Post::V1::ListPostQuotesRequest.new(post_id: post.id, **params))
  end

  def presented_everywhere(post, viewer:)
    act_as(viewer)
    [
      rpc(:get_post, Post::V1::GetPostRequest.new(id: post.id)).post,
      rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: post.author_profile_id)).posts.find { |presented| presented.id == post.id },
      list_posts_by_ids.call(post_ids: [post.id], viewer_profile_id: viewer).fetch(post.id)
    ]
  end

  def expect_frame_unavailable(quote, viewer:)
    presented_everywhere(quote, viewer: viewer).each do |presented|
      # to_h drops default values, so a missing frame would also match the empty hash.
      expect(presented.quoted_post).to be_a(Post::V1::QuotedPost)
      expect(presented.quoted_post.to_h).to eq(Post::V1::QuotedPost.new(available: false).to_h)
    end
  end

  def disable(profile_id)
    db[:profile__profiles].where(id: profile_id).update(disabled_at: Time.now)
  end

  def deactivate_account_of(profile_id)
    db[:identity__accounts].where(id: db[:profile__profiles].where(id: profile_id).select(:account_id)).update(deactivated_at: Time.now)
  end

  describe "the frame" do
    it "returns the frame with author, body, media, and schedule when the viewer can see the original" do
      mentioned = create_account_with_profile(username: "quote_mentioned")
      media_id = SecureRandom.uuid_v7
      media_repo.create(id: media_id, media_type: "image", media_key: "uploads/#{media_id}.jpg")
      post_repo.save_media(post_id: original.id, media_data: [{ media_id: media_id, media_type: "image" }])
      post_repo.save_hashtags(post_id: original.id, hashtags: ["words"])
      post_repo.save_mentions(post_id: original.id, mentions: [{ profile_id: mentioned, position: 0, length: 16 }])
      row = schedule_repo.upsert(profile_id: author, work_date: "2026-11-20", start_time: "20:00", end_time: "02:00")
      schedule_repo.set_post_id(id: row[:id], post_id: original.id)
      quote = quote_of(original)

      presented_everywhere(quote, viewer: viewer).each do |presented|
        frame = presented.quoted_post
        expect(frame.available).to be true
        expect(frame.id).to eq(original.id)
        expect(frame.author.username).to eq("quote_author")
        expect(frame.content).to eq("original words")
        expect(frame.media.map(&:media_id)).to eq([media_id])
        expect(frame.media.first.url).not_to be_empty
        expect(frame.published_at).to eq(original.published_at.iso8601)
        expect([frame.schedule.profile_id, frame.schedule.work_date, frame.schedule.start_time, frame.schedule.end_time]).to eq([author, "2026-11-20", "20:00", "02:00"])
        expect(frame.mentions.map(&:username)).to eq(["quote_mentioned"])
        expect(frame.hashtags.to_a).to eq(["words"])
      end
    end

    it "returns the frame from SavePost" do
      act_as(quoter)

      saved = rpc(:save_post, Post::V1::SavePostRequest.new(content: "my take", quoted_post_id: original.id)).post

      expect(post_repo.find_by_id(saved.id).quoted_post_id).to eq(original.id)
      expect([saved.quoted_post.available, saved.quoted_post.id, saved.quoted_post.content]).to eq([true, original.id, "original words"])
    end

    it "does not nest a frame inside a frame" do
      middle = quote_of(original, content: "middle take")
      outer = quote_of(middle, by: viewer, content: "outer take")

      presented_everywhere(outer, viewer: viewer).each do |presented|
        expect(presented.quoted_post.id).to eq(middle.id)
        expect(presented.quoted_post.content).to eq("middle take")
        expect(presented.quoted_post.to_h.keys).not_to include(:quoted_post)
      end
    end

    it "returns only available: false when the original was deleted" do
      quote = quote_of(original)
      post_repo.delete_post(original.id)

      expect_frame_unavailable(quote, viewer: viewer)
    end

    it "returns only available: false when the original expired" do
      quote = quote_of(original)
      post_repo.update_post(original.id, expires_at: now - 1)

      expect_frame_unavailable(quote, viewer: viewer)
    end

    it "returns only available: false when the viewer and the original author block each other in either direction" do
      blocker = create_account_with_profile(username: "quote_blocker")
      blocked = create_account_with_profile(username: "quote_blocked")
      block_repo.block(blocker_profile_id: blocker, blocked_profile_id: author)
      block_repo.block(blocker_profile_id: author, blocked_profile_id: blocked)
      quote = quote_of(original)

      expect_frame_unavailable(quote, viewer: blocker)
      expect_frame_unavailable(quote, viewer: blocked)
    end

    it "returns only available: false when the original author is disabled or the account is deactivated" do
      disabled_author = create_account_with_profile(role: 2, username: "quote_disabled")
      deactivated_author = create_account_with_profile(role: 2, username: "quote_deactivated")
      quotes = [disabled_author, deactivated_author].map do |profile_id|
        quote_of(post_repo.create_post(author_profile_id: profile_id, content: "hidden words", visibility: "public", published_at: now - 3600))
      end
      disable(disabled_author)
      deactivate_account_of(deactivated_author)

      quotes.each { |quote| expect_frame_unavailable(quote, viewer: viewer) }
    end

    it "keeps the frame visible to a third party after the original author blocks the quoter" do
      quote = quote_of(original)
      block_repo.block(blocker_profile_id: author, blocked_profile_id: quoter)

      presented_everywhere(quote, viewer: viewer).each do |presented|
        expect([presented.quoted_post.available, presented.quoted_post.content]).to eq([true, "original words"])
      end
      expect_frame_unavailable(quote, viewer: quoter)
    end

    it "shows the updated words when an announcement is saved again and hides the frame after the announcement is deleted" do
      save_schedule = Schedule::Slice["use_cases.save_schedule"]
      delete_schedule = Schedule::Slice["use_cases.delete_schedule"]
      work_date = now.getlocal("+09:00").to_date.iso8601
      save = lambda do |note|
        save_schedule.call(profile_id: author, work_date: work_date, start_time: "20:00", end_time: "04:00", announce: true, announce_time: "00:00", announce_note: note, now: now - 60)
      end
      announcement = post_repo.find_by_id(save.call("first words")[:post_id])
      quote = quote_of(announcement)

      expect(get_post(quote, viewer: viewer).quoted_post.content).to eq("first words")

      save.call("second words")
      expect(get_post(quote, viewer: viewer).quoted_post.content).to eq("second words")

      delete_schedule.call(profile_id: author, work_date: work_date)
      expect_frame_unavailable(quote, viewer: viewer)
    end

    it "leaves quoted_post empty on a post that is not a quote" do
      presented_everywhere(original, viewer: viewer).each do |presented|
        expect(presented.quoted_post).to be_nil
      end
    end

    it "returns the same quote fields from ListPostsByIds as from list_posts" do
      quote = quote_of(original)
      quote_of(quote, by: viewer)
      broken_quote = quote_of(post_repo.create_post(author_profile_id: author, content: "gone", visibility: "public", published_at: now - 3600), published_at: now - 120)
      post_repo.delete_post(broken_quote.quoted_post_id)
      act_as(viewer)

      listed = rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: quoter)).posts
      hydrated = list_posts_by_ids.call(post_ids: [quote.id, broken_quote.id], viewer_profile_id: viewer)

      expect(listed.map(&:id)).to eq([quote.id, broken_quote.id])
      listed.each do |presented|
        expect(hydrated.fetch(presented.id).quoted_post.to_h).to eq(presented.quoted_post.to_h)
        expect(hydrated.fetch(presented.id).quotes_count).to eq(presented.quotes_count)
      end
      expect(listed.map(&:quotes_count)).to eq([1, 0])
      expect(listed.map { |presented| presented.quoted_post.available }).to eq([true, false])
    end
  end

  describe "the quote count and the quote list" do
    it "counts the quotes each viewer can list" do
      follower = create_account_with_profile(username: "quote_follower")
      pending_follower = create_account_with_profile(username: "quote_pending")
      blocks_quoter = create_account_with_profile(username: "quote_blocks_quoter")
      blocked_by_quoter = create_account_with_profile(username: "quote_blocked_by_quoter")
      disabled_quoter = create_account_with_profile(username: "quote_disabled_quoter")
      deactivated_quoter = create_account_with_profile(username: "quote_deactivated_quoter")
      follow_repo.follow(follower_profile_id: follower, followee_profile_id: quoter, status: "approved")
      follow_repo.follow(follower_profile_id: pending_follower, followee_profile_id: quoter, status: "pending")
      block_repo.block(blocker_profile_id: blocks_quoter, blocked_profile_id: quoter)
      block_repo.block(blocker_profile_id: quoter, blocked_profile_id: blocked_by_quoter)

      everyone = quote_of(original)
      followers_only = quote_of(original, visibility: "private")
      scheduled = quote_of(original, published_at: now + 3600)
      expired = quote_of(original, published_at: now - 7200, expires_at: now - 3600)
      quote_of(original, by: disabled_quoter)
      quote_of(original, by: deactivated_quoter)
      disable(disabled_quoter)
      deactivate_account_of(deactivated_quoter)

      expected = {
        viewer => [everyone],
        nil => [everyone],
        follower => [everyone, followers_only],
        pending_follower => [everyone],
        quoter => [everyone, followers_only, scheduled, expired],
        blocks_quoter => [],
        blocked_by_quoter => []
      }

      expected.each do |profile_id, quotes|
        presented_everywhere(original, viewer: profile_id).each do |presented|
          expect(presented.quotes_count).to eq(quotes.length)
        end
        expect(list_quotes(original, viewer: profile_id).posts.map(&:id)).to match_array(quotes.map(&:id))
      end
    end

    it "orders quotes newest first and pages them with a cursor" do
      oldest = quote_of(original, published_at: now - 300)
      newest = quote_of(original, published_at: now - 100)
      middle = quote_of(original, published_at: now - 200)

      first = list_quotes(original, viewer: viewer, limit: 2)
      expect(first.posts.map(&:id)).to eq([newest.id, middle.id])
      expect(first.has_more).to be true

      second = list_quotes(original, viewer: viewer, limit: 2, cursor: first.next_cursor)
      expect(second.posts.map(&:id)).to eq([oldest.id])
      expect(second.has_more).to be false
      expect(second.next_cursor).to eq("")
    end

    it "fills a page when quotes are filtered out" do
      first_visible = quote_of(original, published_at: now - 100)
      quote_of(original, visibility: "private", published_at: now - 200)
      quote_of(original, visibility: "private", published_at: now - 300)
      second_visible = quote_of(original, published_at: now - 400)
      third_visible = quote_of(original, published_at: now - 500)

      first = list_quotes(original, viewer: viewer, limit: 2)
      expect(first.posts.map(&:id)).to eq([first_visible.id, second_visible.id])
      expect(first.has_more).to be true

      second = list_quotes(original, viewer: viewer, limit: 2, cursor: first.next_cursor)
      expect(second.posts.map(&:id)).to eq([third_visible.id])
      expect(second.has_more).to be false
    end

    it "defaults to 20 quotes and caps a page at 50" do
      51.times { |index| quote_of(original, published_at: now - 100 - index) }

      expect(list_quotes(original, viewer: viewer).posts.length).to eq(20)
      expect(list_quotes(original, viewer: viewer, limit: 500).posts.length).to eq(50)
    end

    it "returns NOT_FOUND from ListPostQuotes when the viewer cannot see the original" do
      followers_only = post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private", published_at: now - 3600)
      blocked = create_account_with_profile(username: "quote_list_blocked")
      block_repo.block(blocker_profile_id: author, blocked_profile_id: blocked)
      deleted = post_repo.create_post(author_profile_id: author, content: "deleted", visibility: "public", published_at: now - 3600)
      post_repo.delete_post(deleted.id)

      [[followers_only, viewer], [original, blocked], [deleted, viewer]].each do |post, profile_id|
        expect { list_quotes(post, viewer: profile_id) }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND) }
      end
    end
  end
end
