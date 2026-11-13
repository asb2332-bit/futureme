class AddAuthentication < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :role, :string, default: "user", null: false
    add_column :users, :google_uid, :string
    add_index :users, :google_uid, unique: true
    add_check_constraint :users, "role IN ('user', 'admin')", name: "users_valid_role"
    # Existing anonymous capsules remain unclaimed; never assign them to a new signup.
    add_reference :capsules, :user, foreign_key: true
  end
end
