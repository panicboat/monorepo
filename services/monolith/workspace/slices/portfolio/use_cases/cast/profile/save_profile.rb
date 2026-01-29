# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class SaveProfile
          class ValidationError < StandardError
            attr_reader :errors

            def initialize(errors)
              @errors = errors
              super(errors.to_h.to_s)
            end
          end

          include Portfolio::Deps[
            repo: "repositories.cast_repository",
            contract: "contracts.cast.save_profile_contract"
          ]

          class HandleNotAvailableError < StandardError; end

          def call(user_id:, name:, bio:, handle: nil, tagline: nil, service_category: nil, location_type: nil, area: nil, default_schedule_start: nil, default_schedule_end: nil, image_path: nil, social_links: nil, age: nil, height: nil, blood_type: nil, three_sizes: nil, tags: nil)
            # 0. Input Validation
            params = {
              user_id: user_id,
              name: name,
              bio: bio,
              handle: handle,
              tagline: tagline,
              service_category: service_category,
              location_type: location_type,
              area: area,
              default_schedule_start: default_schedule_start,
              default_schedule_end: default_schedule_end,
              image_path: image_path,
              social_links: social_links,
              age: age,
              height: height,
              blood_type: blood_type,
              three_sizes: three_sizes,
              tags: tags
            }.compact

            validation = contract.call(params)
            raise ValidationError, validation.errors unless validation.success?

            # Check handle uniqueness
            if handle && !handle.empty? && !repo.handle_available?(handle, exclude_user_id: user_id)
              raise HandleNotAvailableError, "この ID は既に使用されています"
            end

            Hanami.logger.info("SaveProfile Args: tagline=#{tagline}, area=#{area}, service=#{service_category}, social_links=#{social_links}")
            cast = repo.find_by_user_id(user_id)

            attrs = {
              name: name,
              bio: bio,
              handle: handle&.downcase,
              tagline: tagline,
              service_category: service_category,
              location_type: location_type,
              area: area,
              default_schedule_start: default_schedule_start,
              default_schedule_end: default_schedule_end,
              image_path: image_path,
              social_links: social_links ? Sequel.pg_jsonb(social_links) : nil,
              age: age,
              height: height,
              blood_type: blood_type,
              three_sizes: three_sizes ? Sequel.pg_jsonb(three_sizes) : nil,
              tags: tags ? Sequel.pg_jsonb(tags) : nil
            }.compact

            if cast
              repo.update(cast.id, attrs)
            else
              repo.create(
                attrs.merge(
                  user_id: user_id,
                  visibility: "unregistered"
                )
              )
            end
          end
        end
      end
    end
  end
end
