# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"

RSpec.describe "Lists that page through rows written in the same second", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:second) { Time.utc(2026, 10, 1, 12, 0, 0) }
  let(:viewer) { create_account_with_profile(username: "same_second_viewer") }

  def walk(&page)
    first = page.call(nil)
    [first, page.call(first[:next_cursor])]
  end

  it "keeps a bookmark made earlier in the same second on the next page" do
    author = create_account_with_profile(username: "same_second_author")
    post_repo = Post::Slice["repositories.post_repository"]
    posts = 2.times.map { |i| post_repo.create_post(author_profile_id: author, content: "post #{i}", visibility: "public") }
    posts.each { |post| Bookmarks::Slice["repositories.bookmark_repository"].bookmark(profile_id: viewer, post_id: post.id) }
    db[:bookmarks__bookmarks].where(post_id: posts[0].id).update(created_at: second + 0.2)
    db[:bookmarks__bookmarks].where(post_id: posts[1].id).update(created_at: second + 0.5)

    first, rest = walk { |cursor| Bookmarks::Slice["use_cases.list_bookmarks"].call(profile_id: viewer, limit: 1, cursor: cursor) }

    expect((first[:posts] + rest[:posts]).map(&:id)).to eq([posts[1].id, posts[0].id])
  end

  it "keeps a notification fired earlier in the same second on the next page" do
    emit = Notifications::Slice["use_cases.emit"]
    actors = 2.times.map { |i| create_account_with_profile(username: "same_second_actor_#{i}") }
    actors.each { |actor| emit.call(recipient_profile_id: viewer, type: "follow", target_resource_id: actor, actor_profile_id: actor) }
    ids = db[:notifications__notifications].where(recipient_profile_id: viewer).order(:id).select_map(:id)
    db[:notifications__notifications].where(id: ids[0]).update(latest_event_at: second + 0.2)
    db[:notifications__notifications].where(id: ids[1]).update(latest_event_at: second + 0.5)

    first, rest = walk { |cursor| Notifications::Slice["use_cases.list_notifications"].call(recipient_profile_id: viewer, limit: 1, cursor: cursor) }

    expect((first[:rows] + rest[:rows]).map(&:id)).to eq([ids[1], ids[0]])
  end

  it "keeps a visit made earlier in the same second on the next page" do
    repo = Footprints::Slice["repositories.footprints_repository"]
    visitors = 2.times.map { |i| create_account_with_profile(username: "same_second_visitor_#{i}") }
    visitors.each { |visitor| repo.upsert_visit(visitor_profile_id: visitor, visited_profile_id: viewer) }
    db[:footprints__visits].where(visitor_profile_id: visitors[0]).update(last_visited_at: second + 0.2)
    db[:footprints__visits].where(visitor_profile_id: visitors[1]).update(last_visited_at: second + 0.5)

    first, rest = walk { |cursor| Footprints::Slice["use_cases.list_footprints"].call(viewer_profile_id: viewer, limit: 1, cursor: cursor) }

    expect((first[:rows] + rest[:rows]).map { |row| row[:visitor_profile_id] }).to eq([visitors[1], visitors[0]])
  end

  it "keeps a profile created earlier in the same second on the next page of the user search" do
    older = create_account_with_profile(username: "same_second_older", created_at: second + 0.2)
    newer = create_account_with_profile(username: "same_second_newer", created_at: second + 0.5)

    first, rest = walk { |cursor| Discovery::Slice["use_cases.search_users"].call(query: "same_second_", limit: 1, cursor: cursor) }

    expect((first[:profiles] + rest[:profiles]).map(&:id)).to eq([newer, older])
  end
end
