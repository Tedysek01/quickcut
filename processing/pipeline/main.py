import os
import shutil
import time
from models.transcript import Transcript
from models.edit_config import AiAnalysis, EditConfig
from pipeline.utils import (
    update_status, get_project_data, save_field, save_clip,
    download_from_storage, upload_to_storage, extract_audio,
    get_video_metadata, create_temp_dir, get_db,
    concat_videos, generate_proxy,
)
from pipeline.transcribe import transcribe
from pipeline.analyze import analyze_transcript
from pipeline.editor import generate_edit_config
from pipeline.renderer import render_clip, generate_thumbnail


def run_pipeline(uid: str, project_id: str, storage_url: str, format: str, preferences: dict, language: str = "en", source_videos: list = None):
    """Main pipeline orchestrator. Idempotent — checks existing data before each step.

    source_videos: optional list of dicts with storageUrl, order, originalName etc.
    When provided with >1 entry, videos are concatenated before processing.
    """
    print(f"Starting pipeline for user={uid}, project={project_id}, language={language}")
    start_time = time.time()

    tmp_dir = create_temp_dir()
    video_path = os.path.join(tmp_dir, "raw.mp4")

    try:
        project = get_project_data(uid, project_id)

        # Step 0: Multi-source concatenation (if multiple source videos)
        if source_videos and len(source_videos) > 1 and not project.get("rawVideo", {}).get("fps"):
            print(f"Step 0: Concatenating {len(source_videos)} source videos...")
            sorted_sources = sorted(source_videos, key=lambda x: x.get("order", 0))

            source_paths = []
            for sv in sorted_sources:
                local_path = os.path.join(tmp_dir, f"source_{sv.get('order', 0)}.mp4")
                download_from_storage(sv["storageUrl"], local_path)
                source_paths.append(local_path)

            # Concatenate into one file
            concat_path = os.path.join(tmp_dir, "concatenated.mp4")
            concat_videos(source_paths, concat_path)

            # Upload concatenated file
            concat_url = upload_to_storage(
                concat_path, f"raw/{uid}/{project_id}/concatenated.mp4"
            )

            # Get metadata and update project
            metadata = get_video_metadata(concat_path)
            save_field(uid, project_id, "rawVideo", {
                "storageUrl": concat_url,
                **metadata,
            })

            # Update source video offsets from actual durations
            offset = 0.0
            updated_sources = []
            for i, sv in enumerate(sorted_sources):
                sv_meta = get_video_metadata(source_paths[i])
                updated_sources.append({
                    **sv,
                    "duration": sv_meta["duration"],
                    "offsetInTimeline": offset,
                })
                offset += sv_meta["duration"]
            save_field(uid, project_id, "sourceVideos", updated_sources)

            storage_url = concat_url
            # Use concatenated file for rest of pipeline
            os.rename(concat_path, video_path)

        # Step 1-2: Download + extract metadata
        if not project.get("rawVideo", {}).get("fps"):
            print("Step 1-2: Downloading video and extracting metadata...")
            update_status(uid, project_id, "transcribing")
            download_from_storage(storage_url, video_path)
            metadata = get_video_metadata(video_path)
            save_field(uid, project_id, "rawVideo", {
                "storageUrl": storage_url,
                **metadata,
            })
        elif not os.path.exists(video_path):
            print("Step 1-2: Metadata already exists, downloading video...")
            download_from_storage(storage_url, video_path)

        # Step 0.5: Generate proxy (if not already done)
        if not project.get("proxyUrl"):
            print("Step 0.5: Generating 480p proxy for browser editing...")
            save_field(uid, project_id, "proxyStatus", "generating")
            proxy_path = os.path.join(tmp_dir, "proxy.mp4")
            try:
                generate_proxy(video_path, proxy_path)
                proxy_url = upload_to_storage(
                    proxy_path, f"raw/{uid}/{project_id}/proxy.mp4"
                )
                save_field(uid, project_id, "proxyUrl", proxy_url)
                save_field(uid, project_id, "proxyStatus", "ready")
            except Exception as e:
                print(f"Proxy generation failed (non-fatal): {e}")
                save_field(uid, project_id, "proxyStatus", "none")

        # Step 3: Transcribe
        transcript_data = project.get("transcript")
        if not transcript_data:
            print("Step 3: Transcribing audio...")
            update_status(uid, project_id, "transcribing")
            audio_path = extract_audio(video_path)
            is_podcast = format == "podcast"
            transcript = transcribe(audio_path, language=language, diarize=is_podcast)
            save_field(uid, project_id, "transcript", transcript.model_dump())
            # Clean up audio file
            os.remove(audio_path)
        else:
            print("Step 3: Transcript already exists, skipping...")
            transcript = Transcript(**transcript_data)

        # Step 4: AI Analysis
        analysis_data = project.get("aiAnalysis")
        if not analysis_data:
            print("Step 4: Running AI analysis...")
            update_status(uid, project_id, "analyzing")
            metadata = project.get("rawVideo", get_video_metadata(video_path))
            analysis = analyze_transcript(
                transcript, format, metadata.get("duration", 0), preferences
            )
            save_field(uid, project_id, "aiAnalysis", analysis.model_dump())
        else:
            print("Step 4: Analysis already exists, skipping...")
            analysis = AiAnalysis(**analysis_data)

        # Step 5-6: Generate edit configs + render
        print(f"Step 5-6: Processing {len(analysis.suggestedClips)} suggested clips...")
        update_status(uid, project_id, "rendering")

        total_clips = len(analysis.suggestedClips)
        for i, suggestion in enumerate(analysis.suggestedClips):
            clip_id = f"clip_{i}"
            print(f"  Rendering clip {i+1}/{total_clips}: {suggestion.title}")

            # Check if clip already rendered
            db = get_db()
            clip_ref = db.document(f"users/{uid}/projects/{project_id}/clips/{clip_id}")
            clip_doc = clip_ref.get()
            if clip_doc.exists and clip_doc.to_dict().get("status") == "done":
                print(f"  Clip {clip_id} already done, skipping...")
                continue

            # Generate edit config
            edit_config = generate_edit_config(suggestion, analysis, transcript, preferences)

            # Save clip with pending status
            from firebase_admin import firestore as fs
            save_clip(uid, project_id, clip_id, {
                "createdAt": fs.SERVER_TIMESTAMP,
                "updatedAt": fs.SERVER_TIMESTAMP,
                "status": "rendering",
                "title": suggestion.title,
                "order": i,
                "source": {
                    "startTime": suggestion.start,
                    "endTime": suggestion.end,
                    "duration": round(suggestion.end - suggestion.start, 2),
                },
                "editConfig": edit_config.model_dump(),
                "rendered": None,
                "publishing": {"tiktok": None, "instagram": None, "youtube": None},
                "analytics": {"tiktok": None, "instagram": None, "youtube": None},
            })

            # Render
            clip_tmp = create_temp_dir()
            try:
                # Get words for this clip segment
                clip_words = [
                    w for w in transcript.words
                    if w.start >= suggestion.start and w.end <= suggestion.end
                ]

                final_path = render_clip(
                    video_path, edit_config, clip_words,
                    suggestion.start, suggestion.end, clip_tmp
                )

                # Generate thumbnail
                thumb_path = os.path.join(clip_tmp, "thumbnail.jpg")
                generate_thumbnail(final_path, thumb_path)

                # Upload rendered clip
                video_url = upload_to_storage(
                    final_path,
                    f"rendered/{uid}/{project_id}/{clip_id}/final.mp4"
                )
                thumb_url = upload_to_storage(
                    thumb_path,
                    f"rendered/{uid}/{project_id}/{clip_id}/thumbnail.jpg"
                )

                # Get file size
                file_size = os.path.getsize(final_path)

                # Update clip status
                save_clip(uid, project_id, clip_id, {
                    "status": "done",
                    "updatedAt": fs.SERVER_TIMESTAMP,
                    "rendered": {
                        "videoUrl": video_url,
                        "thumbnailUrl": thumb_url,
                        "duration": round(suggestion.end - suggestion.start, 2),
                        "fileSize": file_size,
                    },
                })
            except Exception as e:
                print(f"  ERROR rendering clip {clip_id}: {e}")
                save_clip(uid, project_id, clip_id, {
                    "status": "failed",
                    "updatedAt": fs.SERVER_TIMESTAMP,
                })
            finally:
                shutil.rmtree(clip_tmp, ignore_errors=True)

        # Step 7: Finalize
        elapsed = time.time() - start_time
        print(f"Step 7: Finalizing. Total time: {elapsed:.1f}s")

        from firebase_admin import firestore as fs
        update_status(uid, project_id, "done",
            **{
                "processing.completedAt": fs.SERVER_TIMESTAMP,
                "processing.costs.total": round(elapsed * 0.001, 4),  # rough estimate
            }
        )

        # Increment user usage
        db = get_db()
        from firebase_admin import firestore as fs_module
        db.document(f"users/{uid}").update({
            "usage.clipsThisMonth": fs_module.Increment(total_clips),
            "usage.totalClipsAllTime": fs_module.Increment(total_clips),
        })

        print(f"Pipeline complete! {total_clips} clips rendered in {elapsed:.1f}s")

    except Exception as e:
        print(f"Pipeline error: {e}")
        import traceback
        traceback.print_exc()
        update_status(uid, project_id, "failed", failReason=str(e))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def rerender_single_clip(uid: str, project_id: str, clip_id: str, storage_url: str):
    """Re-render a single clip with its current editConfig."""
    print(f"Re-rendering clip {clip_id} for project {project_id}")

    tmp_dir = create_temp_dir()
    video_path = os.path.join(tmp_dir, "raw.mp4")

    try:
        download_from_storage(storage_url, video_path)

        project = get_project_data(uid, project_id)
        transcript = Transcript(**project["transcript"])

        db = get_db()
        clip_doc = db.document(f"users/{uid}/projects/{project_id}/clips/{clip_id}").get()
        clip_data = clip_doc.to_dict()

        edit_config = EditConfig(**clip_data["editConfig"])
        source = clip_data["source"]
        export_settings = clip_data.get("exportSettings")

        clip_words = [
            w for w in transcript.words
            if w.start >= source["startTime"] and w.end <= source["endTime"]
        ]

        clip_tmp = create_temp_dir()
        final_path = render_clip(
            video_path, edit_config, clip_words,
            source["startTime"], source["endTime"], clip_tmp,
            export_settings=export_settings,
        )

        # Compute output duration: sum of segment durations if segments exist,
        # otherwise fall back to source clip duration
        if edit_config.segments:
            output_duration = sum(
                s.sourceEnd - s.sourceStart for s in edit_config.segments
            )
        else:
            output_duration = source["endTime"] - source["startTime"]

        thumb_path = os.path.join(clip_tmp, "thumbnail.jpg")
        generate_thumbnail(final_path, thumb_path)

        # Use correct extension based on export format
        fmt = (export_settings or {}).get("format", "mp4")
        ext = "mov" if fmt == "mov" else "mp4"
        video_url = upload_to_storage(
            final_path,
            f"rendered/{uid}/{project_id}/{clip_id}/final.{ext}"
        )
        thumb_url = upload_to_storage(
            thumb_path,
            f"rendered/{uid}/{project_id}/{clip_id}/thumbnail.jpg"
        )

        from firebase_admin import firestore as fs
        save_clip(uid, project_id, clip_id, {
            "status": "done",
            "updatedAt": fs.SERVER_TIMESTAMP,
            "rendered": {
                "videoUrl": video_url,
                "thumbnailUrl": thumb_url,
                "duration": round(output_duration, 2),
                "fileSize": os.path.getsize(final_path),
            },
        })

        shutil.rmtree(clip_tmp, ignore_errors=True)
        print(f"Re-render complete for clip {clip_id}")

    except Exception as e:
        print(f"Re-render error: {e}")
        from firebase_admin import firestore as fs
        save_clip(uid, project_id, clip_id, {
            "status": "failed",
            "updatedAt": fs.SERVER_TIMESTAMP,
        })
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
