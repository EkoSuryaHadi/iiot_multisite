"""add registration_status to devices

Revision ID: 003_device_reg_status
Revises: 002_sps_domain_and_assets
Create Date: 2026-10-26 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_device_reg_status"
down_revision: Union[str, None] = "002_sps_domain_and_assets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE devices ADD COLUMN IF NOT EXISTS registration_status VARCHAR(32) DEFAULT 'active' NOT NULL;"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE devices DROP COLUMN IF EXISTS registration_status;"
    )
