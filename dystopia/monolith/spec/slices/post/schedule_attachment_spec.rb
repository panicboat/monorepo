# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe "Post schedule attachment", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }
  let(:list_posts_by_ids) { Post::Slice["use_cases.posts.list_posts_by_ids"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:author) { create_account_with_profile(role: 2, username: "shift_author") }
  let(:viewer) { create_account_with_profile(username: "shift_viewer") }

  def announce(content: "see you", work_date: "2026-10-24", start_time: "20:00", end_time: "02:00", profile_id: author)
    post = post_repo.create_post(author_profile_id: profile_id, content: content, visibility: "public")
    row = schedule_repo.upsert(profile_id: profile_id, work_date: work_date, start_time: start_time, end_time: end_time)
    schedule_repo.set_post_id(id: row[:id], post_id: post.id)
    post
  end

  def rpc(method, message)
    Post::Grpc::PostHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  before do
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = viewer
  end

  after { Current.clear }

  describe "ListPostsByIds" do
    it "sets the schedule of an announcement post and leaves other posts without one" do
      announcement = announce
      plain = post_repo.create_post(author_profile_id: author, content: "plain", visibility: "public")

      result = list_posts_by_ids.call(post_ids: [announcement.id, plain.id], viewer_profile_id: viewer)

      schedule = result.fetch(announcement.id).schedule
      expect([schedule.profile_id, schedule.work_date, schedule.start_time, schedule.end_time]).to eq([author, "2026-10-24", "20:00", "02:00"])
      expect(result.fetch(plain.id).has_schedule?).to be false
    end

    it "shows the new time after the schedule is changed" do
      announcement = announce
      schedule_repo.upsert(profile_id: author, work_date: "2026-10-24", start_time: "21:00", end_time: "03:00")

      schedule = list_posts_by_ids.call(post_ids: [announcement.id], viewer_profile_id: viewer).fetch(announcement.id).schedule

      expect([schedule.start_time, schedule.end_time]).to eq(%w[21:00 03:00])
    end

    it "asks for the schedules of a page once" do
      posts = %w[2026-10-24 2026-10-25 2026-10-26].map { |date| announce(work_date: date) }
      expect_any_instance_of(Post::Adapters::ScheduleAdapter).to receive(:find_by_post_ids).once.and_call_original

      list_posts_by_ids.call(post_ids: posts.map(&:id), viewer_profile_id: viewer)

    end

    it "sets the author's industry" do
      db[:profile__casts].insert(profile_id: author, industry: "fuzoku")
      announcement = announce

      result = list_posts_by_ids.call(post_ids: [announcement.id], viewer_profile_id: viewer)

      expect(result.fetch(announcement.id).author.industry).to eq("fuzoku")
    end
  end

  describe "PostHandler" do
    it "sets the schedule on ListPosts and asks for it once per page" do
      announcements = %w[2026-10-24 2026-10-25].map { |date| announce(work_date: date) }
      plain = post_repo.create_post(author_profile_id: author, content: "plain", visibility: "public")
      expect_any_instance_of(Post::Adapters::ScheduleAdapter).to receive(:find_by_post_ids).once.and_call_original

      posts = rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author)).posts.to_h { |post| [post.id, post] }

      expect(posts.fetch(announcements[0].id).schedule.work_date).to eq("2026-10-24")
      expect(posts.fetch(announcements[1].id).schedule.work_date).to eq("2026-10-25")
      expect(posts.fetch(plain.id).has_schedule?).to be false
    end

    it "sets the schedule and the author's industry on GetPost" do
      db[:profile__casts].insert(profile_id: author, industry: "fuzoku")
      announcement = announce
      plain = post_repo.create_post(author_profile_id: author, content: "plain", visibility: "public")

      got = rpc(:get_post, Post::V1::GetPostRequest.new(id: announcement.id)).post

      expect([got.schedule.profile_id, got.schedule.start_time, got.schedule.end_time]).to eq([author, "20:00", "02:00"])
      expect(got.author.industry).to eq("fuzoku")
      expect(rpc(:get_post, Post::V1::GetPostRequest.new(id: plain.id)).post.has_schedule?).to be false
    end
  end
end
