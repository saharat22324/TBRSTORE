import argparse
import getpass
import hashlib
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path


PROJECT_REF = "tgtuxvmuapiltmkulvlk"


def environment_or_default(name: str, default: str) -> str:
    return os.environ.get(name, "").strip() or default


def find_postgres_tool(name: str) -> Path:
    command = shutil.which(name)
    if command:
        return Path(command)

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        candidates = sorted(
            Path(local_app_data).glob(f"PostgreSQL/*/pgsql/bin/{name}.exe"),
            reverse=True,
        )
        if candidates:
            return candidates[0]

    raise FileNotFoundError(f"{name} was not found")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as backup_file:
        for chunk in iter(lambda: backup_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Back up the TBR Supabase database")
    parser.add_argument("--check", action="store_true", help="verify PostgreSQL tools only")
    parser.add_argument("--output-directory", type=Path, default=Path("backups"))
    parser.add_argument("--password-env", help="environment variable containing the database password")
    parser.add_argument("--encrypt-passphrase-env", help="environment variable containing the GPG passphrase")
    parser.add_argument("--host", default=environment_or_default("SUPABASE_DB_HOST", f"db.{PROJECT_REF}.supabase.co"))
    parser.add_argument("--port", default=environment_or_default("SUPABASE_DB_PORT", "5432"))
    parser.add_argument("--username", default=environment_or_default("SUPABASE_DB_USER", "postgres"))
    parser.add_argument("--database", default=environment_or_default("SUPABASE_DB_NAME", "postgres"))
    args = parser.parse_args()

    pg_dump = find_postgres_tool("pg_dump")
    pg_restore = find_postgres_tool("pg_restore")
    gpg = find_postgres_tool("gpg") if args.encrypt_passphrase_env else None
    version = subprocess.run(
        [pg_dump, "--version"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    print(version)
    if args.check:
        return 0

    password = os.environ.get(args.password_env, "") if args.password_env else getpass.getpass("Supabase database password: ")
    if not password:
        raise ValueError("Database password is empty")
    encryption_passphrase = os.environ.get(args.encrypt_passphrase_env, "") if args.encrypt_passphrase_env else ""
    if args.encrypt_passphrase_env and not encryption_passphrase:
        raise ValueError("Backup encryption passphrase is empty")
    child_environment = os.environ.copy()
    child_environment["PGPASSWORD"] = password
    child_environment["PGSSLMODE"] = "require"
    del password

    args.output_directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dump_path = args.output_directory / f"tbr-production-{stamp}.dump"
    manifest_path = dump_path.with_suffix(".sha256")

    command = [
        pg_dump,
        f"--host={args.host}",
        f"--port={args.port}",
        f"--username={args.username}",
        f"--dbname={args.database}",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        f"--file={dump_path}",
    ]

    try:
        subprocess.run(command, check=True, env=child_environment)
        subprocess.run(
            [pg_restore, "--list", dump_path],
            check=True,
            stdout=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, OSError):
        dump_path.unlink(missing_ok=True)
        raise
    finally:
        child_environment.pop("PGPASSWORD", None)

    final_path = dump_path
    if gpg:
        encrypted_path = dump_path.with_suffix(".dump.gpg")
        try:
            subprocess.run(
                [gpg, "--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-fd", "0",
                 "--symmetric", "--cipher-algo", "AES256", "--output", encrypted_path, dump_path],
                input=encryption_passphrase,
                text=True,
                check=True,
            )
            final_path = encrypted_path
        except (subprocess.CalledProcessError, OSError):
            encrypted_path.unlink(missing_ok=True)
            raise
        finally:
            dump_path.unlink(missing_ok=True)
            encryption_passphrase = ""

    checksum = sha256_file(final_path)
    manifest_path.write_text(f"{checksum}  {final_path.name}\n", encoding="ascii")
    print(f"Backup: {final_path}")
    print(f"SHA256: {checksum}")
    print(f"Bytes: {final_path.stat().st_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
