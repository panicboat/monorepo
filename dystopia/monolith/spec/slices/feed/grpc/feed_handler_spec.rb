# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/feed/grpc/handler"

RSpec.describe Feed::Grpc::Handler, type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }

  def rpc(message)
    described_class.new(method_key: :list_feed, service: double, rpc_desc: double, active_call: double, message: message).list_feed
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  after { Current.clear }

  it "answers INVALID_ARGUMENT for the area feed of a viewer without a prefecture" do
    act_as(create_account_with_profile(username: "no_prefecture"))

    expect { rpc(Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_AREA)) }
      .to raise_error(GRPC::BadStatus) { |e|
        expect([e.code, e.details]).to eq([GRPC::Core::StatusCodes::INVALID_ARGUMENT, "prefecture is required for AREA filter"])
      }
  end

  it "lists the area feed of the viewer's own prefecture" do
    tokyo_author = create_account_with_profile(role: 2, username: "tokyo_author", prefecture: "東京都")
    osaka_author = create_account_with_profile(role: 2, username: "osaka_author", prefecture: "大阪府")
    post_repo.create_post(author_profile_id: osaka_author, content: "osaka", visibility: "public")
    tokyo_post = post_repo.create_post(author_profile_id: tokyo_author, content: "tokyo", visibility: "public")
    act_as(create_account_with_profile(username: "tokyo_viewer", prefecture: "東京都"))

    res = rpc(Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_AREA))

    expect(res.posts.map(&:id)).to contain_exactly(tokyo_post.id.to_s)
  end
end
