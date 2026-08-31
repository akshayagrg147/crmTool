"""Small S3 adapter used for organization branding assets.

The bucket is intentionally private. Browsers receive a short-lived presigned
GET URL through the public branding route, so an organization's object key is
never exposed as a public bucket path and no AWS credentials reach the client.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings

try:  # Keep local development usable before optional production dependencies install.
    import boto3
except ImportError:  # pragma: no cover - exercised only in an unconfigured dev environment
    boto3 = None


class ObjectStorageError(RuntimeError):
    """Raised when S3 is unavailable or not configured."""


def _endpoint_url() -> str | None:
    """Use the regional S3 endpoint so presigned URLs are not redirected."""
    if settings.s3_endpoint_url:
        return settings.s3_endpoint_url
    if settings.s3_region:
        return f"https://s3.{settings.s3_region}.amazonaws.com"
    return None


@lru_cache(maxsize=1)
def _client():
    if not settings.s3_bucket:
        raise ObjectStorageError("Logo storage is not configured. Set S3_BUCKET on the server.")
    if boto3 is None:
        raise ObjectStorageError("Logo storage is unavailable because the boto3 package is not installed.")
    return boto3.client(
        "s3",
        region_name=settings.s3_region or None,
        endpoint_url=_endpoint_url(),
    )


def upload_logo(key: str, content: bytes, content_type: str) -> None:
    try:
        _client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="public, max-age=86400",
            ContentDisposition="inline",
        )
    except ObjectStorageError:
        raise
    except Exception as exc:  # boto3 exposes several provider-specific exception classes.
        raise ObjectStorageError("The logo could not be uploaded to S3.") from exc


def delete_object(key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=key)
    except ObjectStorageError:
        raise
    except Exception as exc:
        raise ObjectStorageError("The previous logo could not be removed from S3.") from exc


def presigned_download_url(key: str, expires_in: int = 3600) -> str:
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except ObjectStorageError:
        raise
    except Exception as exc:
        raise ObjectStorageError("The organization logo is temporarily unavailable.") from exc
