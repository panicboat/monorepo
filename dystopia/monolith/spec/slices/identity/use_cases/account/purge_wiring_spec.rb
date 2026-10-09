# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe "Identity::UseCases::Account::PurgeDeactivatedAccounts wiring", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:like_repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:bookmark_repo) { Bookmarks::Slice["repositories.bookmark_repository"] }
  let(:access_repo) { Karte::Slice["repositories.access_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:footprints_repo) { Footprints::Slice["repositories.footprints_repository"] }
  let(:messaging_repo) { Messaging::Slice["repositories.messaging_repository"] }
  let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
  end

  after { Cognito.reset! }

  it "purges profile and account rows across slices while preserving bystander rows" do
    account_id = create_account(role: 2)
    persona_a = create_account_with_profile(account_id: account_id)
    persona_b = create_account_with_profile(account_id: account_id)
    bystander_account_id = create_account(role: 1)
    bystander = create_account_with_profile(account_id: bystander_account_id)
    witness_account_id = create_account(role: 1)
    witness = create_account_with_profile(account_id: witness_account_id)
    block_target_account_id = create_account(role: 1)
    block_target = create_account_with_profile(account_id: block_target_account_id)
    personas = [persona_a, persona_b]

    cast_repo.create(profile_id: persona_a)
    cast_repo.create(profile_id: persona_b)
    cast_repo.create(profile_id: bystander)
    access_repo.grant(account_id: account_id)
    access_repo.grant(account_id: bystander_account_id)
    entry_repo = Karte::Slice["repositories.entry_repository"]
    report_repo = Karte::Slice["repositories.report_repository"]
    reported_entry = entry_repo.create(
      author_account_id: bystander_account_id, author_profile_id: bystander,
      target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil
    )
    report_repo.create(entry_id: reported_entry.id, reporter_account_id: account_id, reason: "x")
    own_entry = entry_repo.create(
      author_account_id: account_id, author_profile_id: persona_a,
      target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil
    )
    report_repo.create(entry_id: own_entry.id, reporter_account_id: bystander_account_id, reason: "x")

    post_a = post_repo.create_post(author_profile_id: persona_a, content: "a")
    post_b = post_repo.create_post(author_profile_id: persona_b, content: "b")
    bystander_post = post_repo.create_post(author_profile_id: bystander, content: "c")
    witness_post = post_repo.create_post(author_profile_id: witness, content: "d")
    like_repo.profile_like(post_id: bystander_post.id, profile_id: persona_a)
    like_repo.profile_like(post_id: bystander_post.id, profile_id: persona_b)
    like_repo.profile_like(post_id: witness_post.id, profile_id: bystander)
    comment_repo.create_comment(post_id: bystander_post.id, author_profile_id: persona_b, content: "hi")
    comment_repo.create_comment(post_id: witness_post.id, author_profile_id: bystander, content: "hello")
    follow_repo.follow(follower_id: persona_a, followee_id: bystander, status: "approved")
    follow_repo.follow(follower_id: bystander, followee_id: persona_b, status: "approved")
    follow_repo.follow(follower_id: bystander, followee_id: witness, status: "approved")
    block_repo.block(blocker_id: persona_b, blocked_id: bystander)
    block_repo.block(blocker_id: bystander, blocked_id: block_target)
    bookmark_repo.bookmark(account_id: persona_a, post_id: bystander_post.id)
    bookmark_repo.bookmark(account_id: bystander, post_id: witness_post.id)

    notification_repo.emit(
      recipient_id: bystander,
      type: "mention",
      target_resource_id: post_a.id,
      actor_id: persona_a
    )
    notification_repo.emit(
      recipient_id: bystander,
      type: "mention",
      target_resource_id: witness_post.id,
      actor_id: bystander
    )
    footprints_repo.upsert_visit(visitor_id: persona_a, visited_id: bystander)
    footprints_repo.upsert_visit(visitor_id: bystander, visited_id: witness)

    account_a, account_b = [persona_a, bystander].sort
    thread = messaging_repo.upsert_thread(account_a: account_a, account_b: account_b)
    messaging_repo.upsert_read_state(thread_id: thread[:id], account_id: persona_a, last_read_message_id: nil)
    messaging_repo.upsert_read_state(thread_id: thread[:id], account_id: bystander, last_read_message_id: nil)
    schedule_repo.upsert(account_id: persona_a, work_date: "2026-10-01", start_time: "20:00", end_time: "02:00")
    schedule_repo.upsert(account_id: bystander, work_date: "2026-10-01", start_time: "20:00", end_time: "02:00")

    db[:identity__accounts].where(id: account_id).update(deactivated_at: Time.now - (31 * 24 * 3600))

    count = Identity::Slice["use_cases.account.purge_deactivated_accounts"].call(now: Time.now)

    expect(count).to eq(1)
    expect(cognito_adapter).to have_received(:admin_delete_user).with(sub: account_id)
    expect(db[:identity__accounts].where(id: account_id).count).to eq(0)
    expect(db[:identity__accounts].where(id: bystander_account_id).count).to eq(1)
    expect(db[:profile__profiles].where(account_id: account_id).count).to eq(0)
    expect(db[:profile__casts].where(profile_id: personas).count).to eq(0)
    expect(db[:karte__access].where(account_id: account_id).count).to eq(0)
    expect(db[:karte__reports].where(reporter_account_id: account_id).count).to eq(0)
    expect(db[:karte__reports].where(reporter_account_id: bystander_account_id).count).to eq(1)
    expect(db[:karte__entries].where(id: own_entry.id).count).to eq(1)
    expect(db[:post__posts].where(author_profile_id: personas).count).to eq(0)
    expect(db[:post__likes].where(profile_id: personas).count).to eq(0)
    expect(db[:post__comments].where(author_profile_id: personas).count).to eq(0)
    expect(db[:social__follows].where(follower_id: personas).or(followee_id: personas).count).to eq(0)
    expect(db[:social__blocks].where(blocker_id: personas).count).to eq(0)
    expect(db[:bookmarks__bookmarks].where(account_id: personas).count).to eq(0)
    expect(db[:notifications__notifications].where(latest_actor_id: personas).count).to eq(0)
    expect(db[:footprints__visits].where(visitor_id: personas).or(visited_id: personas).count).to eq(0)
    expect(db[:messaging__read_states].where(account_id: personas).count).to eq(0)
    expect(db[:messaging__threads].where(account_a: personas).or(account_b: personas).count).to eq(0)
    expect(db[:schedule__schedules].where(account_id: personas).count).to eq(0)

    expect(db[:profile__profiles].where(id: bystander).count).to eq(1)
    expect(db[:profile__casts].where(profile_id: bystander).count).to eq(1)
    expect(db[:karte__access].where(account_id: bystander_account_id).count).to eq(1)
    expect(db[:post__posts].where(id: bystander_post.id).count).to eq(1)
    expect(db[:post__likes].where(profile_id: bystander).count).to eq(1)
    expect(db[:post__comments].where(author_profile_id: bystander).count).to eq(1)
    expect(db[:social__follows].where(follower_id: bystander, followee_id: witness).count).to eq(1)
    expect(db[:social__blocks].where(blocker_id: bystander, blocked_id: block_target).count).to eq(1)
    expect(db[:bookmarks__bookmarks].where(account_id: bystander).count).to eq(1)
    expect(db[:notifications__notifications].where(latest_actor_id: bystander).count).to eq(1)
    expect(db[:footprints__visits].where(visitor_id: bystander, visited_id: witness).count).to eq(1)
    expect(db[:messaging__read_states].where(thread_id: thread[:id], account_id: bystander).count).to eq(1)
    expect(
      db[:messaging__threads].where(id: thread[:id]).where(Sequel.|({ account_a: bystander }, { account_b: bystander })).count
    ).to eq(1)
    expect(db[:schedule__schedules].where(account_id: bystander).count).to eq(1)
  end
end
