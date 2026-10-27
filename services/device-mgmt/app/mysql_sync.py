import logging
from app.config import settings

logger = logging.getLogger("mysql-sync")


def get_mysql_admin_connection():
    import pymysql

    return pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user="root",
        password=settings.mysql_root_password,
        database=settings.mysql_database,
        connect_timeout=3,
        autocommit=True,
    )


def sync_mysql_user(email: str, plain_password: str) -> bool:
    """Membuat atau memperbarui user di MySQL secara otomatis setiap kali
    ada user baru atau pergantian password di device-mgmt.
    """
    if not settings.mysql_sync_enabled:
        return False

    try:
        conn = get_mysql_admin_connection()
        try:
            with conn.cursor() as cursor:
                # Cegah SQL injection dengan escaping via string formatting aman
                escaped_email = email.replace("'", "\\'")
                escaped_pw = plain_password.replace("'", "\\'")

                # Pastikan user ada dan update password
                cursor.execute(f"CREATE USER IF NOT EXISTS '{escaped_email}'@'%' IDENTIFIED BY '{escaped_pw}';")
                cursor.execute(f"ALTER USER '{escaped_email}'@'%' IDENTIFIED BY '{escaped_pw}';")
                cursor.execute(f"GRANT SELECT, INSERT, UPDATE, CREATE, INDEX ON {settings.mysql_database}.* TO '{escaped_email}'@'%';")
                cursor.execute("FLUSH PRIVILEGES;")
                logger.info("User MySQL '%s' berhasil disinkronkan.", email)
                return True
        finally:
            conn.close()
    except Exception as exc:
        logger.warning("Gagal menyinkronkan user '%s' ke MySQL: %s", email, exc)
        return False


def delete_mysql_user(email: str) -> bool:
    """Menghapus user dari MySQL saat user dihapus di device-mgmt."""
    if not settings.mysql_sync_enabled:
        return False

    try:
        conn = get_mysql_admin_connection()
        try:
            with conn.cursor() as cursor:
                escaped_email = email.replace("'", "\\'")
                cursor.execute(f"DROP USER IF EXISTS '{escaped_email}'@'%';")
                cursor.execute("FLUSH PRIVILEGES;")
                logger.info("User MySQL '%s' berhasil dihapus.", email)
                return True
        finally:
            conn.close()
    except Exception as exc:
        logger.warning("Gagal menghapus user '%s' dari MySQL: %s", email, exc)
        return False
