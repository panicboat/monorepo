# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/cast_names"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class CastGenerator < BaseGenerator
        def call
          puts "Generating #{Config::CAST_COUNT} new casts..."

          cast_user_ids = create_cast_users
          create_cast_profiles(cast_user_ids)
          assign_genres(cast_user_ids)
          assign_areas(cast_user_ids)
          create_plans(cast_user_ids)
          create_schedules(cast_user_ids)

          puts "  Created #{cast_user_ids.size} casts with profiles, genres, areas, plans, and schedules"

          { user_ids: cast_user_ids }
        end

        private

        def create_cast_users
          existing_count = db[:identity__users].where(role: 2).count
          start_number = 9000000000 + existing_count

          user_ids = []
          Config::CAST_COUNT.times do |i|
            phone = format("0%011d", start_number + i + 1)

            existing = db[:identity__users].where(phone_number: phone).first
            if existing
              user_ids << existing[:id]
              next
            end

            db[:identity__users].insert(
              phone_number: phone,
              password_digest: PASSWORD_DIGEST,
              role: 2,
              created_at: Time.now,
              updated_at: Time.now
            )
            user_ids << db[:identity__users].where(phone_number: phone).first[:id]
          end

          user_ids
        end

        def create_cast_profiles(user_ids)
          names = Data::CAST_NAMES.shuffle
          genres = db[:portfolio__genres].all.to_a
          areas = db[:portfolio__areas].all.to_a

          # Find highest existing cast slug number
          existing_slugs = db[:portfolio__casts].select(:slug).all.map { |r| r[:slug] }
          max_slug_num = existing_slugs.map { |s| s.match(/^cast_(\d+)$/)&.[](1)&.to_i || 0 }.max || 0

          created_count = 0
          user_ids.each_with_index do |user_id, idx|
            existing = db[:portfolio__casts].where(user_id: user_id).first
            next if existing

            name = names[idx % names.size]
            created_count += 1
            slug = "cast_#{max_slug_num + created_count}"
            visibility = rand < Config::CAST_PRIVATE_RATE ? "private" : "public"

            bio = Data::CAST_BIO_TEMPLATES.sample % {
              name: name,
              hobby: Data::CAST_HOBBIES.sample,
              personality: Data::CAST_PERSONALITIES.sample,
              weekend: Data::CAST_WEEKENDS.sample,
              appeal: Data::CAST_APPEALS.sample,
            }

            db[:portfolio__casts].insert(
              user_id: user_id,
              name: name,
              slug: slug,
              tagline: Data::CAST_CATCHPHRASES.sample,
              bio: bio,
              visibility: visibility,
              registered_at: random_time_in_past(days: 365),
              age: rand(20..35),
              height: (155 + rand(-5..17)), # 150-172cm
              three_sizes: generate_three_sizes.to_json,
              blood_type: %w[A B O AB].sample,
              tags: Data::CAST_TAGS.sample(rand(2..5)).to_json,
              default_schedules: generate_default_schedules.to_json,
              social_links: {}.to_json,
              created_at: Time.now,
              updated_at: Time.now
            )
          end
        end

        def generate_three_sizes
          cups = %w[A B C D E F G]
          cup_weights = [5, 15, 25, 25, 15, 10, 5]
          cup = weighted_sample(cups, cup_weights)

          {
            bust: rand(78..95),
            waist: rand(54..62),
            hip: rand(82..92),
            cup: cup,
          }
        end

        def generate_default_schedules
          schedules = []
          if rand < 0.6
            schedules << { start: "#{rand(10..14)}:00", end: "#{rand(15..17)}:00" }
          end
          schedules << { start: "#{rand(18..20)}:00", end: "#{rand(22..24)}:00" }
          schedules
        end

        def assign_genres(cast_user_ids)
          genres = db[:portfolio__genres].all.to_a
          return if genres.empty?

          cast_user_ids.each do |cast_user_id|
            existing = db[:portfolio__cast_genres].where(cast_user_id: cast_user_id).count
            next if existing > 0

            selected = genres.sample(rand(1..3))
            selected.each do |genre|
              db[:portfolio__cast_genres].insert(
                cast_user_id: cast_user_id,
                genre_id: genre[:id],
                created_at: Time.now
              )
            end
          end
        end

        def assign_areas(cast_user_ids)
          areas = db[:portfolio__areas].all.to_a
          return if areas.empty?

          # Weight towards Tokyo/Osaka
          tokyo_areas = areas.select { |a| a[:prefecture] == "東京都" }
          osaka_areas = areas.select { |a| a[:prefecture] == "大阪府" }
          other_areas = areas - tokyo_areas - osaka_areas

          cast_user_ids.each do |cast_user_id|
            existing = db[:portfolio__cast_areas].where(cast_user_id: cast_user_id).count
            next if existing > 0

            # 60% Tokyo, 25% Osaka, 15% other
            primary_area = if rand < 0.60
                             tokyo_areas.sample
                           elsif rand < 0.85
                             osaka_areas.sample
                           else
                             other_areas.sample
                           end

            selected = [primary_area]
            selected += areas.sample(rand(0..3))
            selected.uniq!

            selected.each do |area|
              db[:portfolio__cast_areas].insert(
                cast_user_id: cast_user_id,
                area_id: area[:id],
                created_at: Time.now
              )
            end
          end
        end

        def create_plans(cast_user_ids)
          plans = [
            { name: "お試し", duration_minutes: 30, price: 5000, is_recommended: false },
            { name: "スタンダード", duration_minutes: 60, price: 10000, is_recommended: true },
            { name: "ロング", duration_minutes: 120, price: 18000, is_recommended: false },
          ]

          cast_user_ids.each do |cast_user_id|
            existing = db[:offer__plans].where(cast_user_id: cast_user_id).count
            next if existing > 0

            plans.each do |plan|
              db[:offer__plans].insert(
                plan.merge(
                  cast_user_id: cast_user_id,
                  created_at: Time.now,
                  updated_at: Time.now
                )
              )
            end
          end
        end

        def create_schedules(cast_user_ids)
          cast_user_ids.each do |cast_user_id|
            existing = db[:offer__schedules].where(cast_user_id: cast_user_id).count
            next if existing > 0

            (0..6).each do |day_offset|
              date = Date.today + day_offset
              next if date.saturday? || date.sunday?

              db[:offer__schedules].insert(
                cast_user_id: cast_user_id,
                date: date,
                start_time: "18:00",
                end_time: "23:00",
                created_at: Time.now,
                updated_at: Time.now
              )
            end
          end
        end
      end
    end
  end
end
