# frozen_string_literal: true

module Notifications
  module Repositories
    class PushSubscriptionRepository < Notifications::DB::Repo
      def upsert(account_id:, endpoint:, p256dh:, auth:)
        now = Time.now
        sql = <<~SQL
          INSERT INTO notifications.push_subscriptions
            (id, account_id, endpoint, p256dh, auth, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (endpoint) DO UPDATE SET
            account_id = EXCLUDED.account_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        push_subscription_records.dataset.db.fetch(sql, SecureRandom.uuid_v7, account_id, endpoint, p256dh, auth, now, now).first
      end

      def list_by_account(account_id)
        push_subscription_records.where(account_id: account_id).order { [created_at.asc, id.asc] }.to_a
      end

      def delete_by_endpoint(endpoint)
        push_subscription_records.dataset.where(endpoint: endpoint).delete
      end

      def delete_for_account(account_id:, endpoint:)
        push_subscription_records.dataset.where(account_id: account_id, endpoint: endpoint).delete
      end

      def delete_by_account(account_id)
        push_subscription_records.dataset.where(account_id: account_id).delete
      end
    end
  end
end
