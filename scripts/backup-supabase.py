import argparse
import getpass
import hashlib
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path


PROJECT_REF = "tgtuxvmuapiltmkulvlk"


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
    args = parser.parse_args()

    pg_dump = find_postgres_tool("pg_dump")
    pg_restore = find_postgres_tool("pg_restore")
    version = subprocess.run(
        [pg_dump, "--version"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    print(version)
    if args.check:
        return 0

    password = getpass.getpass("Supabase database password: ")
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
        f"--host=db.{PROJECT_REF}.supabase.co",
        "--port=5432",
        "--username=postgres",
        "--dbname=postgres",
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

    checksum = sha256_file(dump_path)
    manifest_path.write_text(f"{checksum}  {dump_path.name}\n", encoding="ascii")
    print(f"Backup: {dump_path}")
    print(f"SHA256: {checksum}")
    print(f"Bytes: {dump_path.stat().st_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
