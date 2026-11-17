"""add username, site_id scope, and password_reset_requested_at to users

Revision ID: 004_user_username_site_scope
Revises: 43a38ac6e553
Create Date: 2026-11-17 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_user_username_site_scope"
down_revision: Union[str, None] = "43a38ac6e553"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=64), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.add_column("users", sa.Column("site_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_site_id_sites",
        "users",
        "sites",
        ["site_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "users",
        sa.Column("password_reset_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=False)
    op.drop_column("users", "password_reset_requested_at")
    op.drop_constraint("fk_users_site_id_sites", "users", type_="foreignkey")
    op.drop_column("users", "site_id")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
