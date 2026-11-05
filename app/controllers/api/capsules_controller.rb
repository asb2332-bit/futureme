class Api::CapsulesController < ApplicationController
  skip_forgery_protection

  before_action :set_capsule, only: :show
  rescue_from ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError, with: :invalid_capsule_request

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
    unless submitted_capsule.is_a?(ActionController::Parameters)
      raise ActionController::ParameterMissing, :capsule
    end

    attributes = submitted_capsule.permit(:title, :message, :unlock_at).to_h
    attributes["design"] = submitted_capsule.to_unsafe_h["design"] if submitted_capsule.key?(:design)
    attributes
  end

  def invalid_capsule_request(error)
    message = error.is_a?(ActionDispatch::Http::Parameters::ParseError) ? "Request body must be valid JSON." : "Capsule must be a JSON object."
    render json: { errors: { capsule: [message] } }, status: :bad_request
  end

  def capsule_json(capsule, include_message: false)
    unlocked = capsule.unlocked?
    poster_design = PosterDesign.new(capsule.design)
    design = poster_design.public_data
    message = nil

    if include_message && unlocked
      message = capsule.message
      design["sealed_blocks"] = poster_design.sealed_data
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
end
