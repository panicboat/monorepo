# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"
require "slices/post/grpc/comment_handler"
require "slices/profile/grpc/profile_handler"

RSpec.describe "Attaching media and discarding it with what it was attached to", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:owner) { create_account_with_profile(username: "media_owner") }
  let(:other) { create_account_with_profile(username: "media_other") }

  before { allow(Storage).to receive(:delete).and_return(true) }
  after { Current.clear }

  def act_as(profile_id)
    Current.account_id = db[:profile__profiles].where(id: profile_id).get(:account_id)
    Current.profile_id = profile_id
  end

  def rpc(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def upload(profile_id)
    SecureRandom.uuid_v7.tap do |id|
      db[:media__files].insert(id: id, media_type: "image", media_key: "media/#{profile_id}/#{id}.jpg", uploader_profile_id: profile_id)
    end
  end

  def save_post(media_ids, id: "")
    media = media_ids.map { |media_id| Post::V1::PostMedia.new(media_id: media_id, media_type: "image") }
    rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(id: id, content: "with media", media: media)).post
  end

  def add_comment(post_id, media_ids, parent_id: "")
    media = media_ids.map { |media_id| Post::V1::CommentMedia.new(media_id: media_id, media_type: "image") }
    rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: post_id, content: "with media", parent_id: parent_id, media: media)).comment
  end

  def invalid_argument = raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }

  def media_left(*ids) = db[:media__files].where(id: ids).select_map(:id)

  describe "attaching" do
    it "attaches media the acting profile uploaded to a post and a comment" do
      act_as(owner)
      post = save_post([upload(owner)])
      comment = add_comment(post.id, [upload(owner)])

      expect([post.media.length, comment.media.length]).to eq([1, 1])
    end

    it "refuses media another profile uploaded on a post, a comment, an avatar and a cover" do
      act_as(owner)
      own_post = save_post([])
      foreign = upload(other)

      expect { save_post([foreign]) }.to invalid_argument
      expect { save_post([foreign], id: own_post.id) }.to invalid_argument
      expect { add_comment(own_post.id, [foreign]) }.to invalid_argument
      expect { rpc(Profile::Grpc::ProfileHandler, :save_profile_media, Profile::V1::SaveProfileMediaRequest.new(avatar_media_id: foreign)) }.to invalid_argument
      expect { rpc(Profile::Grpc::ProfileHandler, :save_profile_media, Profile::V1::SaveProfileMediaRequest.new(cover_media_id: foreign)) }.to invalid_argument
      expect(db[:post__posts].where(author_profile_id: owner).count).to eq(1)
      expect(db[:post__post_media].where(media_id: foreign).count + db[:post__comment_media].where(media_id: foreign).count).to eq(0)
      expect(db[:profile__profiles].where(id: owner).get(%i[avatar_media_id cover_media_id])).to eq([nil, nil])
    end

    it "removes every attachment when a post is saved again without any" do
      act_as(owner)
      post = save_post([upload(owner)])

      saved = save_post([], id: post.id)

      expect(saved.media).to be_empty
      expect(db[:post__post_media].where(post_id: post.id).count).to eq(0)
    end

    it "refuses media that does not exist" do
      act_as(owner)

      expect { save_post([SecureRandom.uuid_v7]) }.to invalid_argument
    end

    it "sets the acting profile's own media as its avatar and cover" do
      act_as(owner)
      avatar = upload(owner)
      cover = upload(owner)

      rpc(Profile::Grpc::ProfileHandler, :save_profile_media, Profile::V1::SaveProfileMediaRequest.new(avatar_media_id: avatar, cover_media_id: cover))

      expect(db[:profile__profiles].where(id: owner).get(%i[avatar_media_id cover_media_id])).to eq([avatar, cover])
    end
  end

  describe "discarding" do
    it "deletes the media of a deleted post and of every comment on it" do
      act_as(owner)
      post_media = upload(owner)
      post = save_post([post_media])
      act_as(other)
      comment_media = upload(other)
      add_comment(post.id, [comment_media])

      act_as(owner)
      rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: post.id))

      expect(media_left(post_media, comment_media)).to be_empty
      expect(Storage).to have_received(:delete).with(key: "media/#{owner}/#{post_media}.jpg")
    end

    it "deletes the media of a deleted comment and of its replies" do
      act_as(owner)
      post = save_post([])
      comment_media = upload(owner)
      comment = add_comment(post.id, [comment_media])
      act_as(other)
      reply_media = upload(other)
      add_comment(post.id, [reply_media], parent_id: comment.id)

      act_as(owner)
      rpc(Post::Grpc::CommentHandler, :delete_comment, Post::V1::DeleteCommentRequest.new(comment_id: comment.id))

      expect(media_left(comment_media, reply_media)).to be_empty
    end

    it "keeps media still attached to another post or comment, or used as an avatar or a cover" do
      act_as(owner)
      shared_with_post = upload(owner)
      shared_with_comment = upload(owner)
      avatar = upload(owner)
      cover = upload(owner)
      deleted = save_post([shared_with_post, shared_with_comment, avatar, cover])
      kept = save_post([shared_with_post])
      add_comment(kept.id, [shared_with_comment])
      rpc(Profile::Grpc::ProfileHandler, :save_profile_media, Profile::V1::SaveProfileMediaRequest.new(avatar_media_id: avatar, cover_media_id: cover))

      rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: deleted.id))

      expect(media_left(shared_with_post, shared_with_comment, avatar, cover)).to contain_exactly(shared_with_post, shared_with_comment, avatar, cover)
      expect(Storage).not_to have_received(:delete)
    end
  end
end
