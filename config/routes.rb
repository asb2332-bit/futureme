Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get "/login", to: "sessions#new", as: :login
  post "/login", to: "sessions#create"
  post "/logout", to: "sessions#destroy", as: :logout
  get "/signup", to: "registrations#new", as: :signup
  post "/signup", to: "registrations#create"
  get "/auth/google_oauth2/callback", to: "oauth#create"
  get "/auth/failure", to: "oauth#failure"
  get "/admin", to: "admin#index", as: :admin
  post "/capsules/:id/delete", to: "capsule_deletions#create"
  post "/rails/active_storage/direct_uploads", to: "direct_uploads#create"

  namespace :api do
    resource :session, only: :show
    resources :uploads, only: :create
    resources :capsules, only: %i[index create show update destroy] do
      post :open, on: :member
    end
  end

  root to: redirect("/index.html")
end
