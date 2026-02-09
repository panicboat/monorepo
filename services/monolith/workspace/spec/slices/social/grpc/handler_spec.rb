# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/storage"
require "slices/social/grpc/handler"

RSpec.describe Social::Grpc::Handler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      list_posts_uc: list_posts_uc,
      save_post_uc: save_post_uc,
      delete_post_uc: delete_post_uc,
      like_repo: like_repo
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { "user-123" }

  let(:list_posts_uc) { double(:list_posts_uc) }
  let(:save_post_uc) { double(:save_post_uc) }
  let(:delete_post_uc) { double(:delete_post_uc) }
  let(:like_repo) { double(:like_repo) }
  let(:comment_repo) { double(:comment_repo, comments_count_batch: {}) }

  let(:mock_cast) do
    double(
      :cast,
      id: "cast-123",
      user_id: "user-123",
      name: "Yuna",
      image_path: "http://img.jpg",
      avatar_path: nil,
      handle: "yuna",
      visibility: "public",
      registered_at: Time.now
    )
  end

  let(:mock_post) do
    double(
      :post,
      id: "post-1",
      cast_id: "cast-123",
      content: "Hello world",
      visibility: "public",
      cast_post_media: [],
      cast_post_hashtags: [],
      created_at: Time.parse("2026-01-01T10:00:00Z")
    )
  end

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
    # Mock cross-slice access to Portfolio via Query objects
    cast_query = double(:cast_query)
    allow(cast_query).to receive(:call).with(user_ids: ["user-123"]).and_return([mock_cast])
    allow(cast_query).to receive(:call).with(cast_ids: anything).and_return([])
    allow(Portfolio::Slice).to receive(:[]).with("use_cases.cast.queries.get_by_user_ids").and_return(cast_query)
    allow(Portfolio::Slice).to receive(:[]).with("use_cases.cast.queries.get_by_ids").and_return(cast_query)

    guest_query = double(:guest_query)
    allow(guest_query).to receive(:call).and_return([])
    allow(Portfolio::Slice).to receive(:[]).with("use_cases.guest.queries.get_by_user_ids").and_return(guest_query)
    allow(Portfolio::Slice).to receive(:[]).with("use_cases.guest.queries.get_by_ids").and_return(guest_query)

    # Mock Storage
    allow(Storage).to receive(:download_url) { |key:| "/uploads/#{key}" }
  end

  describe "#list_cast_posts" do
    let(:message) { ::Social::V1::ListCastPostsRequest.new(cast_id: "", limit: 20, cursor: "") }

    it "returns posts for the authenticated user's cast" do
      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 20, cursor: nil)
        .and_return({ posts: [mock_post], next_cursor: nil, has_more: false })
      allow(like_repo).to receive(:likes_count_batch).and_return({})

      response = handler.list_cast_posts

      expect(response).to be_a(::Social::V1::ListCastPostsResponse)
      expect(response.posts.size).to eq(1)
      expect(response.posts.first.id).to eq("post-1")
      expect(response.posts.first.author.name).to eq("Yuna")
      expect(response.has_more).to eq(false)
    end

    it "passes cursor when provided" do
      cursor = Base64.urlsafe_encode64('{"created_at":"2026-01-01T10:00:00Z","id":"p1"}', padding: false)
      let_message = ::Social::V1::ListCastPostsRequest.new(cast_id: "", limit: 10, cursor: cursor)

      handler_with_cursor = described_class.new(
        method_key: :test, service: double, rpc_desc: double, active_call: double,
        message: let_message,
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc,
        like_repo: like_repo
      )

      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 10, cursor: cursor)
        .and_return({ posts: [], next_cursor: nil, has_more: false })
      allow(like_repo).to receive(:likes_count_batch).and_return({})

      handler_with_cursor.list_cast_posts
    end

    it "uses default limit when limit is 0" do
      message_zero = ::Social::V1::ListCastPostsRequest.new(cast_id: "", limit: 0, cursor: "")

      handler_zero = described_class.new(
        method_key: :test, service: double, rpc_desc: double, active_call: double,
        message: message_zero,
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc,
        like_repo: like_repo
      )

      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 20, cursor: nil)
        .and_return({ posts: [], next_cursor: nil, has_more: false })
      allow(like_repo).to receive(:likes_count_batch).and_return({})

      handler_zero.list_cast_posts
    end

    it "returns public timeline when no user (unauthenticated)" do
      allow(Current).to receive(:user_id).and_return(nil)

      list_public_posts_uc = double(:list_public_posts_uc)
      like_repo = double(:like_repo)
      comment_repo = double(:comment_repo)

      handler_unauth = described_class.new(
        method_key: :test, service: double, rpc_desc: double, active_call: double,
        message: message,
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc,
        list_public_posts_uc: list_public_posts_uc, like_repo: like_repo, comment_repo: comment_repo
      )

      allow(list_public_posts_uc).to receive(:call)
        .with(limit: 20, cursor: nil, cast_id: nil, exclude_cast_ids: [])
        .and_return({ posts: [mock_post], next_cursor: nil, has_more: false, authors: { "cast-123" => mock_cast } })
      allow(like_repo).to receive(:likes_count_batch).and_return({})
      allow(like_repo).to receive(:liked_status_batch).and_return({})
      allow(comment_repo).to receive(:comments_count_batch).and_return({})

      response = handler_unauth.list_cast_posts

      expect(response).to be_a(::Social::V1::ListCastPostsResponse)
      expect(response.posts.size).to eq(1)
    end
  end

  describe "#save_cast_post" do
    context "creating a new post" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "",
          content: "Hello world",
          media: [],
          visibility: "public"
        )
      end

      it "calls save use case and returns response" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: nil, content: "Hello world", hashtags: [], media: [], visibility: "public")
          .and_return(mock_post)

        response = handler.save_cast_post

        expect(response).to be_a(::Social::V1::SaveCastPostResponse)
        expect(response.post.id).to eq("post-1")
        expect(response.post.content).to eq("Hello world")
        expect(response.post.author.name).to eq("Yuna")
        expect(response.post.visibility).to eq("public")
      end
    end

    context "creating a private post" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "",
          content: "Private post",
          media: [],
          visibility: "private"
        )
      end

      it "passes visibility private to use case" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: nil, content: "Private post", hashtags: [], media: [], visibility: "private")
          .and_return(mock_post)

        handler.save_cast_post
      end
    end

    context "updating an existing post" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "post-1",
          content: "Updated content",
          media: [],
          visibility: "public"
        )
      end

      it "calls save use case with id" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: "post-1", content: "Updated content", hashtags: [], media: [], visibility: "public")
          .and_return(mock_post)

        response = handler.save_cast_post
        expect(response).to be_a(::Social::V1::SaveCastPostResponse)
      end
    end

    context "with media" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "",
          content: "With media",
          media: [::Social::V1::CastPostMedia.new(media_type: "image", url: "http://img.jpg", thumbnail_url: "")],
          visibility: "public"
        )
      end

      it "passes media data to use case" do
        expect(save_post_uc).to receive(:call)
          .with(
            cast_id: "cast-123",
            id: nil,
            content: "With media",
            hashtags: [],
            media: [{ media_type: "image", url: "http://img.jpg", thumbnail_url: "" }],
            visibility: "public"
          )
          .and_return(mock_post)

        handler.save_cast_post
      end
    end

    context "when unauthenticated" do
      let(:message) { ::Social::V1::SaveCastPostRequest.new(id: "", content: "Test", visibility: "public") }

      it "raises unauthenticated when no user" do
        allow(Current).to receive(:user_id).and_return(nil)
        expect { handler.save_cast_post }.to raise_error(GRPC::BadStatus) { |e|
          expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
        }
      end
    end

    it "raises INVALID_ARGUMENT on validation error" do
      let_message = ::Social::V1::SaveCastPostRequest.new(id: "", content: "Test")

      handler_val = described_class.new(
        method_key: :test, service: double, rpc_desc: double, active_call: double,
        message: let_message,
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc
      )

      validation_error = Social::UseCases::Posts::SavePost::ValidationError.new(double(to_h: { content: ["error"] }))
      expect(save_post_uc).to receive(:call).and_raise(validation_error)

      expect { handler_val.save_cast_post }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      }
    end
  end

  describe "#delete_cast_post" do
    let(:message) { ::Social::V1::DeleteCastPostRequest.new(id: "post-1") }

    it "deletes the post and returns empty response" do
      expect(delete_post_uc).to receive(:call)
        .with(cast_id: "cast-123", post_id: "post-1")

      response = handler.delete_cast_post

      expect(response).to be_a(::Social::V1::DeleteCastPostResponse)
    end

    it "raises unauthenticated when no user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.delete_cast_post }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end

    it "raises NOT_FOUND when cast not found" do
      cast_query = double(:cast_query)
      allow(cast_query).to receive(:call).with(user_ids: ["user-123"]).and_return([])
      allow(Portfolio::Slice).to receive(:[]).with("use_cases.cast.queries.get_by_user_ids").and_return(cast_query)

      expect { handler.delete_cast_post }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end
end
