# frozen_string_literal: true

module Portfolio
  module UseCases
    module Guest
      class SaveProfile
        class ValidationError < StandardError; end

        include Deps["repositories.guest_repository"]

        NAME_MIN_LENGTH = 1
        NAME_MAX_LENGTH = 20
        TAGLINE_MAX_LENGTH = 100
        BIO_MAX_LENGTH = 1000

        # @param user_id [String]
        # @param name [String]
        # @param avatar_path [String, nil]
        # @param tagline [String, nil]
        # @param bio [String, nil]
        def call(user_id:, name:, avatar_path: nil, tagline: nil, bio: nil)
          validate_name!(name)
          validate_tagline!(tagline) if tagline
          validate_bio!(bio) if bio

          guest = guest_repository.find_by_user_id(user_id)

          attrs = {
            name: name,
            avatar_path: avatar_path,
            tagline: tagline,
            bio: bio,
            updated_at: Time.now
          }

          if guest
            guest_repository.update(guest.id, attrs)
          else
            guest_repository.create(attrs.merge(user_id: user_id, created_at: Time.now))
          end

          guest_repository.find_by_user_id(user_id)
        end

        private

        def validate_name!(name)
          if name.nil? || name.strip.empty?
            raise ValidationError, "名前は必須です"
          end

          if name.length < NAME_MIN_LENGTH
            raise ValidationError, "名前は#{NAME_MIN_LENGTH}文字以上で入力してください"
          end

          if name.length > NAME_MAX_LENGTH
            raise ValidationError, "名前は#{NAME_MAX_LENGTH}文字以内で入力してください"
          end
        end

        def validate_tagline!(tagline)
          return if tagline.nil? || tagline.empty?

          if tagline.length > TAGLINE_MAX_LENGTH
            raise ValidationError, "一言紹介は#{TAGLINE_MAX_LENGTH}文字以内で入力してください"
          end
        end

        def validate_bio!(bio)
          return if bio.nil? || bio.empty?

          if bio.length > BIO_MAX_LENGTH
            raise ValidationError, "自己紹介は#{BIO_MAX_LENGTH}文字以内で入力してください"
          end
        end
      end
    end
  end
end
