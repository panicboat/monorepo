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

          class SlugNotAvailableError < StandardError; end

          def call(user_id:, name:, bio:, slug: nil, tagline: nil, default_schedule_start: nil, default_schedule_end: nil, image_path: nil, social_links: nil, age: nil, height: nil, blood_type: nil, three_sizes: nil, tags: nil, area_ids: nil, genre_ids: nil)
            # 0. Input Validation
            params = {
              user_id: user_id,
              name: name,
              bio: bio,
              slug: slug,
              tagline: tagline,
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

            # Check slug uniqueness
            if slug && !slug.empty? && !repo.slug_available?(slug, exclude_user_id: user_id)
              raise SlugNotAvailableError, "この ID は既に使用されています"
            end

            Hanami.logger.info("SaveProfile Args: tagline=#{tagline}, social_links=#{social_links}")
            cast = repo.find_by_user_id(user_id)

            attrs = {
              name: name,
              bio: bio,
              slug: slug&.downcase,
              tagline: tagline,
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

            result = if cast
              repo.update(cast.id, attrs)
            else
              repo.create(
                attrs.merge(
                  user_id: user_id,
                  visibility: "public"
                )
              )
            end

            cast_id = result.respond_to?(:id) ? result.id : (cast&.id || repo.find_by_user_id(user_id)&.id)

            # Save area associations if provided
            if area_ids && cast_id
              repo.save_areas(cast_id: cast_id, area_ids: area_ids)
            end

            # Save genre associations if provided
            if genre_ids && cast_id
              repo.save_genres(cast_id: cast_id, genre_ids: genre_ids)
            end

            result
          end
        end
      end
    end
  end
end
