# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::Policies::AccessPolicy do
  let(:policy) { described_class.new(follow_repo: follow_repo, block_repo: block_repo) }
  let(:follow_repo) { double(:follow_repo) }
  let(:block_repo) { double(:block_repo) }

  # =============================================================================
  # Test Data Setup (mirrors seeds.rb visibility matrix)
  # =============================================================================
  #
  # Casts:
  #   Yuna (public)  - handle: "yuna"
  #   Mio  (private) - handle: "mio"
  #   Rin  (public)  - handle: "rin"
  #
  # Guests:
  #   太郎 (id: "taro")   - follows Yuna(approved), Mio(approved), blocks Rin
  #   次郎 (id: "jiro")   - no follows
  #   三郎 (id: "saburo") - follows Mio(pending)
  #   四郎 (id: "shiro")  - follows Rin(approved)
  #
  # Visibility Matrix:
  #   |                    | Yuna(public)  | Mio(private)  | Rin(public)   |
  #   |                    | pub   | priv  | pub   | priv  | pub   | priv  |
  #   |--------------------|-------|-------|-------|-------|-------|-------|
  #   | 太郎(Y+M follow)    |  ○    |   ○   |   ○   |   ○   |   ×   |   ×   | ※Rinをブロック
  #   | 次郎(no follow)     |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |
  #   | 三郎(M pending)     |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |
  #   | 四郎(R follow)      |  ○    |   ×   |   ×   |   ×   |   ○   |   ○   |
  #   | 未認証ユーザー        |  ○    |   ×   |   ×   |   ×   |   ○   |   ×   |
  # =============================================================================

  # Casts
  let(:yuna) { double(:cast, id: "yuna-id", visibility: "public") }   # Public cast
  let(:mio) { double(:cast, id: "mio-id", visibility: "private") }    # Private cast
  let(:rin) { double(:cast, id: "rin-id", visibility: "public") }     # Public cast

  # Posts
  let(:yuna_public_post) { double(:post, cast_id: "yuna-id", visibility: "public") }
  let(:yuna_private_post) { double(:post, cast_id: "yuna-id", visibility: "private") }
  let(:mio_public_post) { double(:post, cast_id: "mio-id", visibility: "public") }
  let(:mio_private_post) { double(:post, cast_id: "mio-id", visibility: "private") }
  let(:rin_public_post) { double(:post, cast_id: "rin-id", visibility: "public") }
  let(:rin_private_post) { double(:post, cast_id: "rin-id", visibility: "private") }

  # Guest IDs
  let(:taro_id) { "taro-guest-id" }
  let(:jiro_id) { "jiro-guest-id" }
  let(:saburo_id) { "saburo-guest-id" }
  let(:shiro_id) { "shiro-guest-id" }

  describe "#can_view_post? - Visibility Matrix Tests" do
    # ==========================================================================
    # Combined Visibility Rule:
    # cast.visibility='public' AND post.visibility='public' → 誰でも閲覧可能
    # Otherwise → 承認済みフォロワー(status='approved')のみ閲覧可能
    # ブロックしているキャストの投稿は一切閲覧不可
    # ==========================================================================

    context "未認証ユーザー (viewer_guest_id: nil)" do
      it "can view public cast + public post (Yuna public)" do
        allow(block_repo).to receive(:blocked?).and_return(false)

        result = policy.can_view_post?(post: yuna_public_post, cast: yuna, viewer_guest_id: nil)
        expect(result).to eq(true)
      end

      it "cannot view public cast + private post (Yuna private)" do
        allow(block_repo).to receive(:blocked?).and_return(false)

        result = policy.can_view_post?(post: yuna_private_post, cast: yuna, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "cannot view private cast + public post (Mio public)" do
        allow(block_repo).to receive(:blocked?).and_return(false)

        result = policy.can_view_post?(post: mio_public_post, cast: mio, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "cannot view private cast + private post (Mio private)" do
        allow(block_repo).to receive(:blocked?).and_return(false)

        result = policy.can_view_post?(post: mio_private_post, cast: mio, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "can view public cast + public post (Rin public)" do
        allow(block_repo).to receive(:blocked?).and_return(false)

        result = policy.can_view_post?(post: rin_public_post, cast: rin, viewer_guest_id: nil)
        expect(result).to eq(true)
      end
    end

    context "太郎 - Yuna(approved), Mio(approved), Rin(blocked)" do
      before do
        allow(follow_repo).to receive(:following?).with(cast_id: "yuna-id", guest_id: taro_id).and_return(true)
        allow(follow_repo).to receive(:following?).with(cast_id: "mio-id", guest_id: taro_id).and_return(true)
        allow(follow_repo).to receive(:following?).with(cast_id: "rin-id", guest_id: taro_id).and_return(false)

        allow(block_repo).to receive(:blocked?).with(blocker_id: taro_id, blocked_id: "yuna-id").and_return(false)
        allow(block_repo).to receive(:blocked?).with(blocker_id: taro_id, blocked_id: "mio-id").and_return(false)
        allow(block_repo).to receive(:blocked?).with(blocker_id: taro_id, blocked_id: "rin-id").and_return(true)
      end

      it "can view Yuna public post" do
        result = policy.can_view_post?(post: yuna_public_post, cast: yuna, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end

      it "can view Yuna private post (approved follower)" do
        result = policy.can_view_post?(post: yuna_private_post, cast: yuna, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end

      it "can view Mio public post (approved follower of private cast)" do
        result = policy.can_view_post?(post: mio_public_post, cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end

      it "can view Mio private post (approved follower of private cast)" do
        result = policy.can_view_post?(post: mio_private_post, cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end

      it "cannot view Rin public post (blocked)" do
        result = policy.can_view_post?(post: rin_public_post, cast: rin, viewer_guest_id: taro_id)
        expect(result).to eq(false)
      end

      it "cannot view Rin private post (blocked)" do
        result = policy.can_view_post?(post: rin_private_post, cast: rin, viewer_guest_id: taro_id)
        expect(result).to eq(false)
      end
    end

    context "次郎 - no follows" do
      before do
        allow(follow_repo).to receive(:following?).and_return(false)
        allow(block_repo).to receive(:blocked?).and_return(false)
      end

      it "can view Yuna public post (public cast + public post)" do
        result = policy.can_view_post?(post: yuna_public_post, cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(true)
      end

      it "cannot view Yuna private post (not a follower)" do
        result = policy.can_view_post?(post: yuna_private_post, cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio public post (private cast, not a follower)" do
        result = policy.can_view_post?(post: mio_public_post, cast: mio, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio private post (private cast, not a follower)" do
        result = policy.can_view_post?(post: mio_private_post, cast: mio, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "can view Rin public post (public cast + public post)" do
        result = policy.can_view_post?(post: rin_public_post, cast: rin, viewer_guest_id: jiro_id)
        expect(result).to eq(true)
      end

      it "cannot view Rin private post (not a follower)" do
        result = policy.can_view_post?(post: rin_private_post, cast: rin, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end
    end

    context "三郎 - Mio(pending)" do
      before do
        # pending status is treated as not following (following? returns false)
        allow(follow_repo).to receive(:following?).and_return(false)
        allow(block_repo).to receive(:blocked?).and_return(false)
      end

      it "can view Yuna public post" do
        result = policy.can_view_post?(post: yuna_public_post, cast: yuna, viewer_guest_id: saburo_id)
        expect(result).to eq(true)
      end

      it "cannot view Yuna private post" do
        result = policy.can_view_post?(post: yuna_private_post, cast: yuna, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio public post (pending != approved)" do
        result = policy.can_view_post?(post: mio_public_post, cast: mio, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio private post (pending != approved)" do
        result = policy.can_view_post?(post: mio_private_post, cast: mio, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "can view Rin public post" do
        result = policy.can_view_post?(post: rin_public_post, cast: rin, viewer_guest_id: saburo_id)
        expect(result).to eq(true)
      end

      it "cannot view Rin private post" do
        result = policy.can_view_post?(post: rin_private_post, cast: rin, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end
    end

    context "四郎 - Rin(approved)" do
      before do
        allow(follow_repo).to receive(:following?).with(cast_id: "yuna-id", guest_id: shiro_id).and_return(false)
        allow(follow_repo).to receive(:following?).with(cast_id: "mio-id", guest_id: shiro_id).and_return(false)
        allow(follow_repo).to receive(:following?).with(cast_id: "rin-id", guest_id: shiro_id).and_return(true)
        allow(block_repo).to receive(:blocked?).and_return(false)
      end

      it "can view Yuna public post" do
        result = policy.can_view_post?(post: yuna_public_post, cast: yuna, viewer_guest_id: shiro_id)
        expect(result).to eq(true)
      end

      it "cannot view Yuna private post (not a follower)" do
        result = policy.can_view_post?(post: yuna_private_post, cast: yuna, viewer_guest_id: shiro_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio public post (private cast, not a follower)" do
        result = policy.can_view_post?(post: mio_public_post, cast: mio, viewer_guest_id: shiro_id)
        expect(result).to eq(false)
      end

      it "cannot view Mio private post (private cast, not a follower)" do
        result = policy.can_view_post?(post: mio_private_post, cast: mio, viewer_guest_id: shiro_id)
        expect(result).to eq(false)
      end

      it "can view Rin public post" do
        result = policy.can_view_post?(post: rin_public_post, cast: rin, viewer_guest_id: shiro_id)
        expect(result).to eq(true)
      end

      it "can view Rin private post (approved follower)" do
        result = policy.can_view_post?(post: rin_private_post, cast: rin, viewer_guest_id: shiro_id)
        expect(result).to eq(true)
      end
    end
  end

  describe "#filter_viewable_posts" do
    let(:casts_map) do
      {
        "yuna-id" => yuna,
        "mio-id" => mio,
        "rin-id" => rin,
      }
    end

    let(:all_posts) do
      [
        yuna_public_post,
        yuna_private_post,
        mio_public_post,
        mio_private_post,
        rin_public_post,
        rin_private_post,
      ]
    end

    it "returns only public cast + public posts for unauthenticated user" do
      allow(block_repo).to receive(:blocked_cast_ids).and_return([])

      result = policy.filter_viewable_posts(posts: all_posts, casts_map: casts_map, viewer_guest_id: nil)

      expect(result).to contain_exactly(yuna_public_post, rin_public_post)
    end

    it "filters based on follow status and blocks for 太郎" do
      allow(block_repo).to receive(:blocked_cast_ids).with(blocker_id: taro_id).and_return(["rin-id"])
      allow(follow_repo).to receive(:following_status_batch)
        .with(cast_ids: ["yuna-id", "mio-id", "rin-id"], guest_id: taro_id)
        .and_return({
          "yuna-id" => "approved",
          "mio-id" => "approved",
          "rin-id" => nil,
        })

      result = policy.filter_viewable_posts(posts: all_posts, casts_map: casts_map, viewer_guest_id: taro_id)

      # 太郎 can view Yuna (all), Mio (all), but Rin is blocked
      expect(result).to contain_exactly(
        yuna_public_post,
        yuna_private_post,
        mio_public_post,
        mio_private_post
      )
    end

    it "returns only public cast + public posts for 次郎 (no follows)" do
      allow(block_repo).to receive(:blocked_cast_ids).with(blocker_id: jiro_id).and_return([])
      allow(follow_repo).to receive(:following_status_batch)
        .with(cast_ids: ["yuna-id", "mio-id", "rin-id"], guest_id: jiro_id)
        .and_return({})

      result = policy.filter_viewable_posts(posts: all_posts, casts_map: casts_map, viewer_guest_id: jiro_id)

      expect(result).to contain_exactly(yuna_public_post, rin_public_post)
    end

    it "returns public + Rin private for 四郎 (Rin approved)" do
      allow(block_repo).to receive(:blocked_cast_ids).with(blocker_id: shiro_id).and_return([])
      allow(follow_repo).to receive(:following_status_batch)
        .with(cast_ids: ["yuna-id", "mio-id", "rin-id"], guest_id: shiro_id)
        .and_return({ "rin-id" => "approved" })

      result = policy.filter_viewable_posts(posts: all_posts, casts_map: casts_map, viewer_guest_id: shiro_id)

      expect(result).to contain_exactly(yuna_public_post, rin_public_post, rin_private_post)
    end

    it "returns empty array for empty posts" do
      result = policy.filter_viewable_posts(posts: [], casts_map: casts_map, viewer_guest_id: nil)
      expect(result).to eq([])
    end
  end
end
