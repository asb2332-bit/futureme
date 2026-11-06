Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :capsules, only: %i[index create show] do
      post :open, on: :member
    end
    resources :uploads, only: :create
  end

  root to: redirect("/index.html")
end
