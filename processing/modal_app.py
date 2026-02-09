import modal
import os

app = modal.App("clipai-processing")

processing_dir = os.path.dirname(os.path.abspath(__file__))

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "deepgram-sdk>=3.0.0",
        "google-genai",
        "firebase-admin>=6.0.0",
        "Pillow>=10.0.0",
        "pydantic>=2.0.0",
        "fastapi[standard]",
    )
    .add_local_dir(processing_dir, remote_path="/root/processing", ignore=[
        "**/__pycache__", "**/.env", "**/service-account*", "**/node_modules", "**/.git",
    ])
)

all_secrets = [
    modal.Secret.from_name("firebase-service-account"),
    modal.Secret.from_name("deepgram-api-key"),
    modal.Secret.from_name("google-ai-key"),
]


@app.function(
    image=image,
    timeout=600,
    secrets=all_secrets,
)
def process_video(uid: str, project_id: str, storage_url: str, format: str, preferences: dict, language: str = "en", source_videos: list = None):
    """Main entry point — process a full video."""
    import sys
    sys.path.insert(0, "/root/processing")
    from pipeline.main import run_pipeline

    run_pipeline(uid, project_id, storage_url, format, preferences, language=language, source_videos=source_videos)


@app.function(
    image=image,
    timeout=300,
    secrets=all_secrets,
)
def rerender_clip(uid: str, project_id: str, clip_id: str, storage_url: str):
    """Re-render a single clip with updated editConfig."""
    import sys
    sys.path.insert(0, "/root/processing")
    from pipeline.main import rerender_single_clip

    rerender_single_clip(uid, project_id, clip_id, storage_url)


@app.function(
    image=image,
    secrets=all_secrets,
    timeout=600,
)
@modal.fastapi_endpoint(method="POST")
def process_endpoint(data: dict):
    """HTTP endpoint called by Cloud Functions."""
    import sys
    sys.path.insert(0, "/root/processing")

    action = data.get("action", "process")

    if action == "process":
        from pipeline.main import run_pipeline
        run_pipeline(
            uid=data["uid"],
            project_id=data["projectId"],
            storage_url=data["storageUrl"],
            format=data["format"],
            language=data.get("language", "en"),
            preferences=data.get("preferences", {}),
            source_videos=data.get("sourceVideos"),
        )
        return {"status": "ok", "job_id": f"{data['uid']}_{data['projectId']}"}

    elif action == "rerender":
        from pipeline.main import rerender_single_clip
        rerender_single_clip(
            uid=data["uid"],
            project_id=data["projectId"],
            clip_id=data["clipId"],
            storage_url=data["storageUrl"],
        )
        return {"status": "ok", "job_id": f"{data['uid']}_{data['clipId']}"}

    return {"status": "error", "message": f"Unknown action: {action}"}


@app.local_entrypoint()
def main():
    """Test entry point."""
    print("ClipAI processing pipeline ready.")
    print("Deploy with: modal deploy modal_app.py")
