class Api::CapsulesController < ApplicationController
  # ponytail: public unauthenticated API; restore CSRF protection when user sessions are added.
  skip_forgery_protection

  before_action :set_capsule, only: :show

  def index
    capsules = Capsule.order(created_at: :desc)

    capsules_as_json = capsules.map do |capsule|
      capsule_json(capsule)
    end

    render json: capsules_as_json
  end

  def create
    submitted_data = capsule_params
    @capsule = Capsule.new(submitted_data)

    if @capsule.save
      capsule_data = capsule_json(@capsule)
      capsule_url = api_capsule_url(@capsule)

      render json: capsule_data, status: :created, location: capsule_url
    else
      validation_errors = @capsule.errors.to_hash(full_messages: true)

      render json: { errors: validation_errors }, status: :unprocessable_entity
    end
  end

  def show
    capsule_data = capsule_json(@capsule, include_message: true)

    render json: capsule_data
  end

  private

  def set_capsule
    capsule_id = params[:id]
    @capsule = Capsule.find(capsule_id)
  end

  def capsule_params
    submitted_capsule = params.require(:capsule)

    submitted_capsule.permit(:title, :message, :unlock_at, design: {})
  end

  def capsule_json(capsule, include_message: false)
    unlocked = capsule.unlocked?
    design = public_design(capsule.design)
    message = nil

    if include_message && unlocked
      message = capsule.message
      design["sealed_blocks"] = capsule.design.fetch("sealed_blocks", [])
    end

    {
      id: capsule.id,
      title: capsule.title,
      unlock_at: capsule.unlock_at,
      created_at: capsule.created_at,
      locked: !unlocked,
      message: message,
      design: design
    }
  end

  def public_design(design)
    {
      "theme" => design.fetch("theme", {}),
      "title_block" => design.fetch("title_block", {}),
      "message_block" => design.fetch("message_block", {}),
      "icon_block" => design.fetch("icon_block", {})
    }
  end
end
