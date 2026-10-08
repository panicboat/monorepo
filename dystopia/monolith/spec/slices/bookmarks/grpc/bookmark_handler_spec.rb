# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/bookmarks/grpc/bookmark_handler"

RSpec.describe Bookmarks::Grpc::BookmarkHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }

  let(:author) { create_account_with_profile(role: 2, username: "bookmark_author") }
  let(:reader) { create_account_with_profile(username: "bookmark_reader") }
  let(:other_reader) { create_account_with_profile(username: "bookmark_other_reader") }
  let!(:first_post) { post_repo.create_post(author_profile_id: author, content: "first", visibility: "public") }
  let!(:second_post) { post_repo.create_post(author_profile_id: author, content: "second", visibility: "public") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def bookmarked_post_ids
    rpc(:list_bookmarks, Bookmarks::V1::ListBookmarksRequest.new).posts.map(&:id)
  end

  def bookmark_status
    rpc(:get_bookmark_status, Bookmarks::V1::GetBookmarkStatusRequest.new(post_ids: [first_post.id, second_post.id])).bookmarked.to_h
  end

  after { Current.clear }

  it "stores a bookmark under the acting profile and lists it only for that profile" do
    act_as(reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))

    expect(db[:bookmarks__bookmarks].select_map([:profile_id, :post_id])).to eq([[reader, first_post.id]])
    expect(bookmarked_post_ids).to eq([first_post.id])
    expect(bookmark_status).to eq(first_post.id => true, second_post.id => false)

    act_as(other_reader)
    expect(bookmarked_post_ids).to be_empty
    expect(bookmark_status).to eq(first_post.id => false, second_post.id => false)
  end

  it "removes only the acting profile's bookmark" do
    act_as(reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))
    act_as(other_reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))

    rpc(:unbookmark, Bookmarks::V1::UnbookmarkRequest.new(post_id: first_post.id))

    expect(db[:bookmarks__bookmarks].select_map(:profile_id)).to eq([reader])
    expect(bookmarked_post_ids).to be_empty
  end
end
