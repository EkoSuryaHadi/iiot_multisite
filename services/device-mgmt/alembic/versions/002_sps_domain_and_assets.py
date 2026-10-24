"""SPS domain and assets

Revision ID: 002_sps_domain_and_assets
Revises: fb7add6de65f
Create Date: 2026-10-25 07:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '002_sps_domain_and_assets'
down_revision: Union[str, None] = 'fb7add6de65f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create enum type site_configuration_type
    site_config_enum = postgresql.ENUM('TYPE_A', 'TYPE_B', 'TYPE_C', 'TYPE_D', name='site_configuration_type', create_type=False)
    site_config_enum.create(op.get_bind(), checkfirst=True)

    # 2. Add nullable columns to sites table for SPS configuration
    op.add_column('sites', sa.Column('site_type', sa.Enum('TYPE_A', 'TYPE_B', 'TYPE_C', 'TYPE_D', name='site_configuration_type'), nullable=True))
    op.add_column('sites', sa.Column('pv_capacity_kwp', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('mppt_capacity_a', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('rectifier_float_voltage', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('baseline_kwh_daily', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('longitude', sa.Float(), nullable=True))
    op.add_column('sites', sa.Column('tower_type', sa.String(length=64), nullable=True))

    # 3. Create device_assets table
    op.create_table(
        'device_assets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.UUID(), nullable=False),
        sa.Column('asset_type', sa.String(length=64), nullable=False),
        sa.Column('brand', sa.String(length=128), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('serial_number', sa.String(length=128), nullable=False),
        sa.Column('warranty_years', sa.Integer(), nullable=True),
        sa.Column('is_spare', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('installed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', 'serial_number', name='uq_device_asset_serial')
    )
    op.create_index(op.f('ix_device_assets_serial_number'), 'device_assets', ['serial_number'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_device_assets_serial_number'), table_name='device_assets')
    op.drop_table('device_assets')
    op.drop_column('sites', 'tower_type')
    op.drop_column('sites', 'longitude')
    op.drop_column('sites', 'latitude')
    op.drop_column('sites', 'baseline_kwh_daily')
    op.drop_column('sites', 'rectifier_float_voltage')
    op.drop_column('sites', 'mppt_capacity_a')
    op.drop_column('sites', 'pv_capacity_kwp')
    op.drop_column('sites', 'site_type')
    sa.Enum(name='site_configuration_type').drop(op.get_bind(), checkfirst=True)
