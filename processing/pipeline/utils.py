import subprocess
import json
import os
import tempfile
import firebase_admin
from firebase_admin import credentials, firestore, storage


_firebase_initialized = False


def init_firebase():
    global _firebase_initialized
    if not _firebase_initialized:
        # Use service account from environment
        sa_key = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
        if sa_key:
            cred = credentials.Certificate(json.loads(sa_key))
            firebase_admin.initialize_app(cred, {
                "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
            })
        else:
            firebase_admin.initialize_app()
        _firebase_initialized = True


def get_db():
    init_firebase()
    return firestore.client()


def get_bucket():
    init_firebase()
    return storage.bucket()


def update_status(uid: str, project_id: str, status: str, **extra):
    db = get_db()
    data = {"status": status, "updatedAt": firestore.SERVER_TIMESTAMP}
    data.update(extra)
    db.document(f"users/{uid}/projects/{project_id}").update(data)


def get_project_data(uid: str, project_id: str) -> dict:
    db = get_db()
    doc = db.document(f"users/{uid}/projects/{project_id}").get()
    return doc.to_dict() if doc.exists else {}


def save_field(uid: str, project_id: str, field: str, value):
    db = get_db()
    db.document(f"users/{uid}/projects/{project_id}").update({
        field: value,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })


def save_clip(uid: str, project_id: str, clip_id: str, data: dict):
    db = get_db()
    db.document(f"users/{uid}/projects/{project_id}/clips/{clip_id}").set(data, merge=True)


def download_from_storage(storage_url: str, local_path: str) -> str:
    """Download a file from Firebase Storage to local path."""
    bucket = get_bucket()

    # Extract path from storage URL or gs:// URL
    if storage_url.startswith("gs://"):
        path = "/".join(storage_url.split("/")[3:])
    elif "firebasestorage.googleapis.com" in storage_url:
        # Extract path from download URL
        import urllib.parse
        parsed = urllib.parse.urlparse(storage_url)
        path = urllib.parse.unquote(parsed.path.split("/o/")[1].split("?")[0])
    else:
        path = storage_url

    blob = bucket.blob(path)
    blob.download_to_filename(local_path)
    return local_path


def upload_to_storage(local_path: str, storage_path: str) -> str:
    """Upload a file to Firebase Storage and return download URL."""
    bucket = get_bucket()
    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path)
    blob.make_public()
    return blob.public_url


def extract_audio(video_path: str) -> str:
    """Extract audio as WAV from video."""
    audio_path = video_path.rsplit(".", 1)[0] + ".wav"
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        "-y", audio_path,
    ], check=True, capture_output=True)
    return audio_path


def get_video_metadata(video_path: str) -> dict:
    """Get video metadata using ffprobe."""
    result = subprocess.run([
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        video_path,
    ], capture_output=True, text=True, check=True)

    data = json.loads(result.stdout)
    video_stream = next(
        (s for s in data.get("streams", []) if s["codec_type"] == "video"),
        {}
    )

    duration = float(data.get("format", {}).get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    fps_parts = video_stream.get("r_frame_rate", "30/1").split("/")
    fps = round(int(fps_parts[0]) / int(fps_parts[1])) if len(fps_parts) == 2 else 30
    file_size = int(data.get("format", {}).get("size", 0))

    return {
        "duration": duration,
        "resolution": {"width": width, "height": height},
        "fps": fps,
        "fileSize": file_size,
    }


def create_temp_dir() -> str:
    """Create a temporary directory for processing."""
    return tempfile.mkdtemp(prefix="clipai_")


def concat_videos(source_paths: list, output_path: str) -> str:
    """Concatenate multiple video files using FFmpeg.

    Tries the fast concat demuxer first (no re-encode).
    Falls back to filter_complex re-encode if codecs differ.
    """
    if len(source_paths) == 1:
        subprocess.run([
            "ffmpeg", "-i", source_paths[0], "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    # Write concat list file
    list_path = output_path + ".txt"
    with open(list_path, "w") as f:
        for path in source_paths:
            f.write(f"file '{path}'\n")

    # Try fast concat demuxer (no re-encode)
    result = subprocess.run([
        "ffmpeg", "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        "-y", output_path,
    ], capture_output=True, text=True)

    if result.returncode != 0:
        # Fallback: re-encode to normalize all inputs
        inputs = []
        filter_parts = []
        for i, path in enumerate(source_paths):
            inputs.extend(["-i", path])
            filter_parts.append(f"[{i}:v][{i}:a]")

        filter_str = f"{''.join(filter_parts)}concat=n={len(source_paths)}:v=1:a=1[outv][outa]"

        subprocess.run([
            "ffmpeg", *inputs,
            "-filter_complex", filter_str,
            "-map", "[outv]", "-map", "[outa]",
            "-c:v", "libx264", "-c:a", "aac",
            "-y", output_path,
        ], check=True, capture_output=True)

    if os.path.exists(list_path):
        os.remove(list_path)

    return output_path


def generate_proxy(video_path: str, output_path: str, height: int = 480) -> str:
    """Generate a low-resolution proxy for browser editing.

    Preserves frame timing exactly (same fps, same frame count).
    Uses fast encoding for small file size.
    """
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vf", f"scale=-2:{height}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "28",
        "-c:a", "aac", "-b:a", "64k",
        "-movflags", "+faststart",
        "-y", output_path,
    ], check=True, capture_output=True)
    return output_path
