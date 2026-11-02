Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :capsules, only: %i[index create show]
  end

  root to: redirect("/index.html")
end
