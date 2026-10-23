# frozen_string_literal: true

module Notifications
  module Repositories
    class PushSubscriptionRepository < Notifications::DB::Repo
      def upsert(account_id:, profile_id:, endpoint:, p256dh:, auth:)
        now = Time.now
        sql = <<~SQL
          INSERT INTO notifications.push_subscriptions
            (id, account_id, profile_id, endpoint, p256dh, auth, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (endpoint, profile_id) DO UPDATE SET
            account_id = EXCLUDED.account_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        db = push_subscription_records.dataset.db
        db.transaction do
          db[:"notifications__push_subscriptions"].exclude(account_id: account_id).where(endpoint: endpoint).delete
          db[:"notifications__push_subscriptions"].where(endpoint: endpoint).update(p256dh: p256dh, auth: auth, updated_at: now)
          db.fetch(sql, SecureRandom.uuid_v7, account_id, profile_id, endpoint, p256dh, auth, now, now).first
        end
      end

      def list_by_profile(profile_id)
        push_subscription_records.where(profile_id: profile_id).order { [created_at.asc, id.asc] }.to_a
      end

      def profile_counts_by_endpoint(profile_ids:, endpoints:)
        return {} if profile_ids.empty? || endpoints.empty?

        push_subscription_records.dataset
          .where(profile_id: profile_ids, endpoint: endpoints)
          .unordered
          .group_and_count(:endpoint)
          .to_h { |row| [row[:endpoint], row[:count]] }
      end

      def subscribed?(profile_id:, endpoint:)
        !push_subscription_records.dataset.where(profile_id: profile_id, endpoint: endpoint).empty?
      end

      def delete_for_profile(profile_id:, endpoint:)
        push_subscription_records.dataset.where(profile_id: profile_id, endpoint: endpoint).delete
      end

      def release_endpoint(account_id:, endpoint:)
        push_subscription_records.dataset.exclude(account_id: account_id).where(endpoint: endpoint).delete
      end

      def delete_by_endpoint(endpoint)
        push_subscription_records.dataset.where(endpoint: endpoint).delete
      end

      def delete_by_profile(profile_id)
        push_subscription_records.dataset.where(profile_id: profile_id).delete
      end

      def delete_by_account(account_id)
        push_subscription_records.dataset.where(account_id: account_id).delete
      end
    end
  end
end
