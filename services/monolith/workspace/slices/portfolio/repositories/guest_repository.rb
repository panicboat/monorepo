# frozen_string_literal: true

module Portfolio
  module Repositories
    class GuestRepository < Portfolio::DB::Repo
      commands :create, update: :by_pk

      def find_by_id(id)
        guests.by_pk(id).one
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        guests.where(id: ids).to_a
      end

      def find_by_user_id(user_id)
        guests.where(user_id: user_id).one
      end

      def find_by_user_ids(user_ids)
        return [] if user_ids.nil? || user_ids.empty?

        guests.where(user_id: user_ids).to_a
      end

      def create(attrs)
        guests.changeset(:create, attrs).commit
      end

      def update(id, attrs)
        guests.by_pk(id).changeset(:update, attrs).commit
      end
    end
  end
end
