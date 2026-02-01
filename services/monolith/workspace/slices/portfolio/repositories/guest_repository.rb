# frozen_string_literal: true

module Portfolio
  module Repositories
    class GuestRepository < Portfolio::DB::Repo
      commands :create, update: :by_pk

      def find_by_user_id(user_id)
        guests.where(user_id: user_id).one
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
