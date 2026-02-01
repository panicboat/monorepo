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
      delete_post_uc: delete_post_uc
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { "user-123" }

  let(:list_posts_uc) { double(:list_posts_uc) }
  let(:save_post_uc) { double(:save_post_uc) }
  let(:delete_post_uc) { double(:delete_post_uc) }

  let(:mock_cast) do
    double(
      :cast,
      id: "cast-123",
      user_id: "user-123",
      name: "Yuna",
      image_path: "http://img.jpg",
      avatar_path: nil,
      handle: "yuna"
    )
  end

  let(:mock_post) do
    double(
      :post,
      id: "post-1",
      cast_id: "cast-123",
      content: "Hello world",
      visible: true,
      cast_post_media: [],
      cast_post_hashtags: [],
      created_at: Time.parse("2026-01-01T10:00:00Z")
    )
  end

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
    # Mock cross-slice access to Portfolio
    cast_repo = double(:cast_repo)
    allow(cast_repo).to receive(:find_by_user_id).with("user-123").and_return(mock_cast)
    allow(Portfolio::Slice).to receive(:[]).with("repositories.cast_repository").and_return(cast_repo)
    # Mock Storage
    allow(Storage).to receive(:download_url) { |key:| "/uploads/#{key}" }
  end

  describe "#list_cast_posts" do
    let(:message) { ::Social::V1::ListCastPostsRequest.new(cast_id: "", limit: 20, cursor: "") }

    it "returns posts for the authenticated user's cast" do
      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 20, cursor: nil)
        .and_return({ posts: [mock_post], next_cursor: nil, has_more: false })

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
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc
      )

      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 10, cursor: cursor)
        .and_return({ posts: [], next_cursor: nil, has_more: false })

      handler_with_cursor.list_cast_posts
    end

    it "uses default limit when limit is 0" do
      message_zero = ::Social::V1::ListCastPostsRequest.new(cast_id: "", limit: 0, cursor: "")

      handler_zero = described_class.new(
        method_key: :test, service: double, rpc_desc: double, active_call: double,
        message: message_zero,
        list_posts_uc: list_posts_uc, save_post_uc: save_post_uc, delete_post_uc: delete_post_uc
      )

      expect(list_posts_uc).to receive(:call)
        .with(cast_id: "cast-123", limit: 20, cursor: nil)
        .and_return({ posts: [], next_cursor: nil, has_more: false })

      handler_zero.list_cast_posts
    end

    it "raises unauthenticated when no user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.list_cast_posts }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end
  end

  describe "#save_cast_post" do
    context "creating a new post" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "",
          content: "Hello world",
          media: [],
          visible: true
        )
      end

      it "calls save use case and returns response" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: nil, content: "Hello world", hashtags: [], media: [], visible: true)
          .and_return(mock_post)

        response = handler.save_cast_post

        expect(response).to be_a(::Social::V1::SaveCastPostResponse)
        expect(response.post.id).to eq("post-1")
        expect(response.post.content).to eq("Hello world")
        expect(response.post.author.name).to eq("Yuna")
        expect(response.post.visible).to eq(true)
      end
    end

    context "creating a hidden post" do
      let(:message) do
        ::Social::V1::SaveCastPostRequest.new(
          id: "",
          content: "Hidden post",
          media: [],
          visible: false
        )
      end

      it "passes visible false to use case" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: nil, content: "Hidden post", hashtags: [], media: [], visible: false)
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
          visible: true
        )
      end

      it "calls save use case with id" do
        expect(save_post_uc).to receive(:call)
          .with(cast_id: "cast-123", id: "post-1", content: "Updated content", hashtags: [], media: [], visible: true)
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
          visible: true
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
            visible: true
          )
          .and_return(mock_post)

        handler.save_cast_post
      end
    end

    context "when unauthenticated" do
      let(:message) { ::Social::V1::SaveCastPostRequest.new(id: "", content: "Test", visible: true) }

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
      cast_repo = double(:cast_repo)
      allow(cast_repo).to receive(:find_by_user_id).with("user-123").and_return(nil)
      allow(Portfolio::Slice).to receive(:[]).with("repositories.cast_repository").and_return(cast_repo)

      expect { handler.delete_cast_post }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end
end
