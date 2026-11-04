class Api::SessionsController < ApplicationController
  def show
    response.headers["Cache-Control"] = "no-store"
    render json: { user: current_user&.as_json(only: %i[email_address role]), csrf_token: form_authenticity_token }
  end
end
