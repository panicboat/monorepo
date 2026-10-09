# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/social/grpc/follow_handler"
require "slices/social/grpc/block_handler"

RSpec.describe "Social slice RPC entry points and the slices that read follows and blocks", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  let(:viewer) { create_account_with_profile(username: "social_viewer") }
  let(:public_cast) { create_account_with_profile(role: 2, username: "social_public") }
  let(:private_cast) { create_account_with_profile(role: 2, username: "social_private", is_private: true) }
  let(:other_guest) { create_account_with_profile(username: "social_other") }

  def rpc(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def follow(target)
    rpc(Social::Grpc::FollowHandler, :follow, Social::V1::FollowRequest.new(target_profile_id: target)).status
  end

  def follow_status(*targets)
    rpc(Social::Grpc::FollowHandler, :get_follow_status, Social::V1::GetFollowStatusRequest.new(target_profile_ids: targets)).statuses.to_h
  end

  def counts(profile_id = "")
    response = rpc(Social::Grpc::FollowHandler, :get_social_counts, Social::V1::GetSocialCountsRequest.new(profile_id: profile_id))
    [response.following_count, response.followers_count]
  end

  after { Current.clear }

  describe "follow RPCs" do
    it "follows a public profile at once and lists both sides by profile" do
      act_as(viewer)

      expect(follow(public_cast)).to eq(:FOLLOW_STATUS_APPROVED)
      expect(follow_status(public_cast, private_cast)).to eq(public_cast => :FOLLOW_STATUS_APPROVED, private_cast => :FOLLOW_STATUS_NONE)
      expect(counts).to eq([1, 0])
      expect(counts(public_cast)).to eq([0, 1])

      following = rpc(Social::Grpc::FollowHandler, :list_following, Social::V1::ListFollowingRequest.new)
      followers = rpc(Social::Grpc::FollowHandler, :list_followers, Social::V1::ListFollowersRequest.new(profile_id: public_cast))
      expect(following.profiles.map(&:id)).to eq([public_cast])
      expect(following.profiles.map(&:role)).to eq([2])
      expect(followers.profiles.map(&:id)).to eq([viewer])
      expect(followers.profiles.map(&:role)).to eq([1])
      expect(db[:social__follows].select_map([:follower_profile_id, :followee_profile_id, :status])).to eq([[viewer, public_cast, "approved"]])

      rpc(Social::Grpc::FollowHandler, :unfollow, Social::V1::UnfollowRequest.new(target_profile_id: public_cast))
      expect(counts).to eq([0, 0])
    end

    it "keeps a follow to a private profile pending until the target approves it" do
      act_as(viewer)
      expect(follow(private_cast)).to eq(:FOLLOW_STATUS_PENDING)
      expect(counts(private_cast)).to eq([0, 0])

      act_as(private_cast)
      pending = rpc(Social::Grpc::FollowHandler, :list_pending_follow_requests, Social::V1::ListPendingFollowRequestsRequest.new)
      pending_count = rpc(Social::Grpc::FollowHandler, :get_pending_follow_count, Social::V1::GetPendingFollowCountRequest.new).count
      expect(pending.profiles.map(&:id)).to eq([viewer])
      expect(pending_count).to eq(1)

      rpc(Social::Grpc::FollowHandler, :approve_follow_request, Social::V1::ApproveFollowRequestRequest.new(requester_profile_id: viewer))
      expect(counts).to eq([0, 1])

      act_as(viewer)
      expect(follow_status(private_cast)).to eq(private_cast => :FOLLOW_STATUS_APPROVED)
    end

    it "lets the target reject a request and the requester cancel one" do
      act_as(viewer)
      follow(private_cast)
      act_as(other_guest)
      follow(private_cast)

      act_as(private_cast)
      rpc(Social::Grpc::FollowHandler, :reject_follow_request, Social::V1::RejectFollowRequestRequest.new(requester_profile_id: viewer))
      act_as(other_guest)
      rpc(Social::Grpc::FollowHandler, :cancel_follow_request, Social::V1::CancelFollowRequestRequest.new(target_profile_id: private_cast))

      expect(db[:social__follows].count).to eq(0)
    end

    it "refuses to follow across a block in either direction" do
      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: viewer)
      block_repo.block(blocker_profile_id: other_guest, blocked_profile_id: private_cast)

      act_as(viewer)
      expect(follow(public_cast)).to eq(:FOLLOW_STATUS_NONE)
      act_as(other_guest)
      expect(follow(private_cast)).to eq(:FOLLOW_STATUS_NONE)
      expect(db[:social__follows].count).to eq(0)
    end
  end

  describe "block RPCs" do
    it "blocks a profile, drops follows in both directions, and reports the block only to the blocker" do
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      follow_repo.follow(follower_profile_id: public_cast, followee_profile_id: viewer, status: "approved")
      act_as(viewer)

      rpc(Social::Grpc::BlockHandler, :block, Social::V1::BlockRequest.new(target_profile_id: public_cast))
      status = rpc(Social::Grpc::BlockHandler, :get_block_status, Social::V1::GetBlockStatusRequest.new(target_profile_ids: [public_cast, private_cast])).blocked.to_h
      listed = rpc(Social::Grpc::BlockHandler, :list_blocked, Social::V1::ListBlockedRequest.new)

      expect(status).to eq(public_cast => true, private_cast => false)
      expect(listed.profiles.map(&:id)).to eq([public_cast])
      expect(listed.profiles.map(&:role)).to eq([2])
      expect(db[:social__follows].count).to eq(0)
      expect(db[:social__blocks].select_map([:blocker_profile_id, :blocked_profile_id])).to eq([[viewer, public_cast]])

      act_as(public_cast)
      seen_by_blocked = rpc(Social::Grpc::BlockHandler, :get_block_status, Social::V1::GetBlockStatusRequest.new(target_profile_ids: [viewer])).blocked.to_h
      expect(seen_by_blocked).to eq(viewer => false)

      act_as(viewer)
      rpc(Social::Grpc::BlockHandler, :unblock, Social::V1::UnblockRequest.new(target_profile_id: public_cast))
      expect(db[:social__blocks].count).to eq(0)
    end
  end

  describe "slices that read follows and blocks" do
    it "lets a guest message a cast only with an approved follow, and never across a block" do
      authorize = Messaging::UseCases::AuthorizeMessage.new
      open_thread = Messaging::Slice["use_cases.get_or_create_thread"]

      expect(authorize.call(sender_profile_id: viewer, recipient_profile_id: public_cast)).to be false
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      expect(authorize.call(sender_profile_id: viewer, recipient_profile_id: public_cast)).to be true
      expect(open_thread.call(viewer_profile_id: viewer, recipient_profile_id: public_cast)[:counterpart].id).to eq(public_cast)

      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: viewer)
      expect { open_thread.call(viewer_profile_id: viewer, recipient_profile_id: public_cast) }
        .to raise_error(Messaging::UseCases::GetOrCreateThread::BlockedError)
      expect { Messaging::Slice["use_cases.send_message"].call(sender_profile_id: viewer, content: "hi", recipient_profile_id: public_cast) }
        .to raise_error(Messaging::UseCases::SendMessage::BlockedError)
    end

    it "records a visit unless either side blocked the other, and hides blocked visitors from the list" do
      record = Footprints::Slice["use_cases.record_visit"]
      list = Footprints::Slice["use_cases.list_footprints"]

      record.call(visitor_profile_id: viewer, visited_profile_id: public_cast)
      record.call(visitor_profile_id: other_guest, visited_profile_id: public_cast)
      expect(list.call(viewer_profile_id: public_cast)[:rows].map { |row| row[:visitor_profile_id] }).to contain_exactly(viewer, other_guest)

      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: other_guest)
      expect(list.call(viewer_profile_id: public_cast)[:rows].map { |row| row[:visitor_profile_id] }).to eq([viewer])
      expect(record.call(visitor_profile_id: other_guest, visited_profile_id: private_cast)).not_to be_nil
      block_repo.block(blocker_profile_id: other_guest, blocked_profile_id: private_cast)
      expect(record.call(visitor_profile_id: private_cast, visited_profile_id: other_guest)).to be_nil
    end

    it "does not notify a recipient who blocked the actor" do
      emit = Notifications::Slice["use_cases.emit"]
      target = SecureRandom.uuid_v7

      delivered = emit.call(recipient_profile_id: public_cast, type: "like", target_resource_id: target, actor_profile_id: viewer)
      block_repo.block(blocker_profile_id: public_cast, blocked_profile_id: other_guest)
      suppressed = emit.call(recipient_profile_id: public_cast, type: "like", target_resource_id: target, actor_profile_id: other_guest)

      expect(delivered).not_to be_nil
      expect(suppressed).to be_nil
    end

    it "lets the review use cases ask the post visibility filter whether a page owner is reachable" do
      entry = Struct.new(:hidden, :author_profile_id, :target_profile_id)
      filter = Review::Slice["use_cases.filter_visible_entries"]
      entry_repo = Review::Slice["repositories.entry_repository"]

      on_public_page = filter.call(viewer_profile_id: viewer, page_owner_profile_id: public_cast, entries: [entry.new(false, other_guest, public_cast)])
      on_private_page = filter.call(viewer_profile_id: viewer, page_owner_profile_id: private_cast, entries: [entry.new(false, other_guest, private_cast)])
      expect(on_public_page.length).to eq(1)
      expect(on_private_page).to eq([])

      entry_repo.create(author_profile_id: other_guest, target_profile_id: public_cast, rating: 4.0, body: "ok")
      entry_repo.create(author_profile_id: other_guest, target_profile_id: private_cast, rating: 4.0, body: "ok")
      recent = Review::Slice["use_cases.list_recent_entries"].call(viewer_profile_id: viewer)
      expect(recent[:entries].length).to eq(1)
    end

    it "gives the review and feed adapters the profiles blocked in either direction and the followed profiles" do
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: private_cast, status: "pending")
      block_repo.block(blocker_profile_id: viewer, blocked_profile_id: other_guest)
      block_repo.block(blocker_profile_id: private_cast, blocked_profile_id: viewer)

      expect(Review::Adapters::BlockAdapter.new.bidirectionally_blocked_profile_ids(profile_id: viewer)).to contain_exactly(other_guest, private_cast)
      expect(Feed::Adapters::BlockAdapter.new.bidirectionally_blocked_profile_ids(profile_id: viewer)).to contain_exactly(other_guest, private_cast)
      expect(Feed::Adapters::FollowAdapter.new.following_profile_ids(profile_id: viewer)).to eq([public_cast])
    end
  end
end
