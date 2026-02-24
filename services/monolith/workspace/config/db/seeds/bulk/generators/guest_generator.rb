# frozen_string_literal: true

require "faker"
require_relative "base_generator"
require_relative "../data/guest_names"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class GuestGenerator < BaseGenerator
        def call
          puts "Generating #{Config::GUEST_COUNT} new guests..."

          guest_user_ids = create_guest_users
          guest_ids = create_guest_profiles(guest_user_ids)
          activity_types = assign_activity_types(guest_ids)

          puts "  Created #{guest_ids.size} guests with profiles"

          { user_ids: guest_user_ids, guest_ids: guest_ids, activity_types: activity_types }
        end

        private

        def create_guest_users
          existing_count = db[:identity__users].where(role: 1).count
          start_number = 8000000000 + existing_count

          user_ids = []
          Config::GUEST_COUNT.times do |i|
            phone = format("0%011d", start_number + i + 1)

            existing = db[:identity__users].where(phone_number: phone).first
            if existing
              user_ids << existing[:id]
              next
            end

            db[:identity__users].insert(
              phone_number: phone,
              password_digest: PASSWORD_DIGEST,
              role: 1,
              created_at: Time.now,
              updated_at: Time.now
            )
            user_ids << db[:identity__users].where(phone_number: phone).first[:id]
          end

          user_ids
        end

        def create_guest_profiles(user_ids)
          # Use static names first, then Faker
          static_names = Data::GUEST_NAMES.shuffle
          Faker::Config.locale = "ja"

          guest_ids = []
          user_ids.each_with_index do |user_id, idx|
            existing = db[:portfolio__guests].where(user_id: user_id).first
            if existing
              guest_ids << existing[:id]
              next
            end

            name = if idx < static_names.size
                     static_names[idx]
                   else
                     Faker::Name.male_first_name
                   end

            # Add nickname variant sometimes
            display_name = if rand < 0.3 && idx < Data::GUEST_NICKNAMES.size
                             Data::GUEST_NICKNAMES.sample
                           else
                             name
                           end

            db[:portfolio__guests].insert(
              user_id: user_id,
              name: display_name,
              created_at: Time.now,
              updated_at: Time.now
            )
            guest_ids << db[:portfolio__guests].where(user_id: user_id).first[:id]
          end

          guest_ids
        end

        def assign_activity_types(guest_ids)
          # Assign activity type to each guest based on distribution
          activity_types = {}
          types = Config::GUEST_ACTIVITY.keys
          weights = Config::GUEST_ACTIVITY.values.map { |v| v[:ratio] }

          guest_ids.each do |guest_id|
            activity_types[guest_id] = weighted_sample(types, weights)
          end

          activity_types
        end
      end
    end
  end
end
