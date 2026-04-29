# video_studio/services/merge_service.py

"""
Video Merge Service
Professional video merging with transitions using MoviePy
"""

import os
import uuid


class VideoMergeService:
    """
    Professional video merging with transitions and effects
    """

    def merge_clips(
        self,
        clip_paths,
        transition_type='crossfade',
        transition_duration=0.5,
        add_captions=False,
        captions_data=None,
        background_music=None,
        music_volume=0.3,
        output_path=None
    ):
        """
        Merge multiple video clips into one

        Args:
            clip_paths (list): List of video file paths in order
            transition_type (str): 'cut', 'crossfade', 'wipe', 'slide', 'zoom'
            transition_duration (float): Seconds for transition
            add_captions (bool): Whether to add text overlays
            captions_data (list): List of caption dicts
            background_music (str): Path to music file
            music_volume (float): Volume level (0-1)
            output_path (str): Output file path

        Returns:
            str: Path to merged video
        """
        try:
            from moviepy.editor import (
                VideoFileClip,
                concatenate_videoclips,
                CompositeVideoClip,
                TextClip,
                AudioFileClip,
                concatenate_audioclips
            )

            # Load all clips
            clips = [VideoFileClip(path) for path in clip_paths]

            if not clips:
                return None

            # Apply transitions
            if transition_type == 'cut':
                final = concatenate_videoclips(clips, method='chain')
            elif transition_type == 'crossfade':
                final = self._crossfade_merge(clips, transition_duration)
            elif transition_type == 'wipe':
                final = self._wipe_merge(clips, transition_duration)
            elif transition_type == 'slide':
                final = self._slide_merge(clips, transition_duration)
            else:
                final = concatenate_videoclips(clips, method='chain')

            # Add captions if requested
            if add_captions and captions_data:
                final = self._add_captions(final, captions_data)

            # Add background music
            if background_music and os.path.exists(background_music):
                final = self._add_background_music(final, background_music, music_volume)

            # Generate output path if not provided
            if not output_path:
                output_path = os.path.join('/tmp', f'merged_{uuid.uuid4().hex}.mp4')

            # Export
            final.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                fps=30,
                preset='medium',
                bitrate='5000k',
                threads=4,
                logger=None  # Suppress verbose output
            )

            # Cleanup
            for clip in clips:
                clip.close()
            final.close()

            return output_path

        except ImportError:
            print("MoviePy not installed. Install with: pip install moviepy")
            return None
        except Exception as e:
            print(f"Failed to merge clips: {e}")
            return None

    def _crossfade_merge(self, clips, duration):
        """
        Crossfade transition between clips

        Args:
            clips (list): List of VideoFileClip objects
            duration (float): Crossfade duration in seconds

        Returns:
            CompositeVideoClip: Merged video with crossfades
        """
        from moviepy.editor import CompositeVideoClip
        from moviepy.video.fx.fadein import fadein
        from moviepy.video.fx.fadeout import fadeout

        if len(clips) == 1:
            return clips[0]

        # Apply fadeout to all except last
        for i in range(len(clips) - 1):
            clips[i] = clips[i].fx(fadeout, duration)

        # Apply fadein to all except first
        for i in range(1, len(clips)):
            clips[i] = clips[i].fx(fadein, duration)

        # Calculate positions (overlapping by duration)
        current_time = 0
        positioned_clips = []

        for i, clip in enumerate(clips):
            clip = clip.set_start(current_time)
            positioned_clips.append(clip)

            if i < len(clips) - 1:
                current_time += clip.duration - duration
            else:
                current_time += clip.duration

        return CompositeVideoClip(positioned_clips)

    def _wipe_merge(self, clips, duration):
        """
        Wipe transition (left to right)

        Args:
            clips (list): List of VideoFileClip objects
            duration (float): Wipe duration in seconds

        Returns:
            CompositeVideoClip: Merged video with wipes
        """
        from moviepy.editor import concatenate_videoclips

        # Simplified wipe - just use concatenate for now
        # Full wipe implementation requires custom masking
        return concatenate_videoclips(clips, method='chain')

    def _slide_merge(self, clips, duration):
        """
        Slide transition (new clip slides in)

        Args:
            clips (list): List of VideoFileClip objects
            duration (float): Slide duration in seconds

        Returns:
            CompositeVideoClip: Merged video with slides
        """
        from moviepy.editor import concatenate_videoclips

        # Simplified slide - just use concatenate for now
        # Full slide implementation requires position animation
        return concatenate_videoclips(clips, method='chain')

    def _add_captions(self, video, captions_data):
        """
        Add text captions to video

        Args:
            video (VideoClip): Video to add captions to
            captions_data (list): List of caption dicts
                Format: [{
                    'text': 'Caption text',
                    'start': 0,
                    'duration': 3,
                    'position': 'bottom',
                    'fontsize': 50,
                    'color': 'white'
                }]

        Returns:
            CompositeVideoClip: Video with captions
        """
        try:
            from moviepy.editor import TextClip, CompositeVideoClip

            text_clips = []

            for caption in captions_data:
                txt_clip = TextClip(
                    caption['text'],
                    fontsize=caption.get('fontsize', 50),
                    color=caption.get('color', 'white'),
                    font=caption.get('font', 'Arial-Bold'),
                    stroke_color=caption.get('stroke_color', 'black'),
                    stroke_width=caption.get('stroke_width', 2),
                    method='caption',
                    size=(int(video.w * 0.8), None)
                )

                # Position
                position = caption.get('position', 'bottom')
                if position == 'bottom':
                    txt_clip = txt_clip.set_position(('center', video.h - 100))
                elif position == 'top':
                    txt_clip = txt_clip.set_position(('center', 50))
                elif position == 'center':
                    txt_clip = txt_clip.set_position('center')
                else:
                    txt_clip = txt_clip.set_position(position)

                txt_clip = txt_clip.set_start(caption['start']).set_duration(caption['duration'])
                text_clips.append(txt_clip)

            return CompositeVideoClip([video] + text_clips)

        except Exception as e:
            print(f"Failed to add captions: {e}")
            return video

    def _add_background_music(self, video, music_path, volume=0.3):
        """
        Add background music to video

        Args:
            video (VideoClip): Video to add music to
            music_path (str): Path to music file
            volume (float): Volume level (0-1)

        Returns:
            VideoClip: Video with background music
        """
        try:
            from moviepy.editor import AudioFileClip, concatenate_audioclips, CompositeAudioClip

            audio = AudioFileClip(music_path)

            # Loop music if shorter than video
            if audio.duration < video.duration:
                n_loops = int(video.duration / audio.duration) + 1
                audio = concatenate_audioclips([audio] * n_loops)

            # Trim to video length
            audio = audio.subclip(0, video.duration)

            # Adjust volume
            audio = audio.volumex(volume)

            # Mix with original audio if exists
            if video.audio:
                final_audio = CompositeAudioClip([video.audio, audio])
            else:
                final_audio = audio

            return video.set_audio(final_audio)

        except Exception as e:
            print(f"Failed to add background music: {e}")
            return video

    # Advanced features

    def add_logo_watermark(self, video_path, logo_path, position='bottom-right', opacity=0.7, size_percent=10):
        """
        Add brand logo watermark to video

        Args:
            video_path (str): Path to video file
            logo_path (str): Path to logo image
            position (str): Position of logo
            opacity (float): Logo opacity (0-1)
            size_percent (int): Logo size as % of video width

        Returns:
            str: Path to watermarked video
        """
        try:
            from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip

            video = VideoFileClip(video_path)
            logo = ImageClip(logo_path).set_opacity(opacity)

            # Resize logo
            logo_width = int(video.w * (size_percent / 100))
            logo = logo.resize(width=logo_width)

            # Position
            padding = int(video.w * 0.02)

            if position == 'bottom-right':
                logo = logo.set_position((video.w - logo.w - padding, video.h - logo.h - padding))
            elif position == 'bottom-left':
                logo = logo.set_position((padding, video.h - logo.h - padding))
            elif position == 'top-right':
                logo = logo.set_position((video.w - logo.w - padding, padding))
            elif position == 'top-left':
                logo = logo.set_position((padding, padding))
            else:
                logo = logo.set_position(position)

            logo = logo.set_duration(video.duration)

            final = CompositeVideoClip([video, logo])

            output_path = video_path.replace('.mp4', '_watermarked.mp4')
            final.write_videofile(output_path, codec='libx264', logger=None)

            video.close()
            final.close()

            return output_path

        except Exception as e:
            print(f"Failed to add logo watermark: {e}")
            return video_path

    def extract_thumbnail(self, video_path, time_offset=1.0):
        """
        Extract thumbnail from video at specific time

        Args:
            video_path (str): Path to video file
            time_offset (float): Time offset in seconds

        Returns:
            bytes: JPEG image data
        """
        try:
            from moviepy.editor import VideoFileClip
            from PIL import Image
            import io

            clip = VideoFileClip(video_path)

            # Get frame at offset
            frame = clip.get_frame(min(time_offset, clip.duration - 0.1))

            # Convert to PIL Image
            img = Image.fromarray(frame)

            # Save to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)

            clip.close()

            return buffer.getvalue()

        except Exception as e:
            print(f"Failed to extract thumbnail: {e}")
            return None

    def get_video_info(self, video_path):
        """
        Get video metadata

        Args:
            video_path (str): Path to video file

        Returns:
            dict: Video metadata
        """
        try:
            from moviepy.editor import VideoFileClip

            clip = VideoFileClip(video_path)

            info = {
                'duration': clip.duration,
                'fps': clip.fps,
                'size': clip.size,  # (width, height)
                'width': clip.w,
                'height': clip.h,
                'aspect_ratio': f"{clip.w}:{clip.h}",
                'has_audio': clip.audio is not None,
            }

            clip.close()

            return info

        except Exception as e:
            print(f"Failed to get video info: {e}")
            return None

    def trim_video(self, video_path, start_time, end_time, output_path=None):
        """
        Trim video to specific time range

        Args:
            video_path (str): Input video path
            start_time (float): Start time in seconds
            end_time (float): End time in seconds
            output_path (str): Output file path

        Returns:
            str: Path to trimmed video
        """
        try:
            from moviepy.editor import VideoFileClip

            clip = VideoFileClip(video_path)
            trimmed = clip.subclip(start_time, end_time)

            if not output_path:
                output_path = video_path.replace('.mp4', '_trimmed.mp4')

            trimmed.write_videofile(output_path, codec='libx264', logger=None)

            clip.close()
            trimmed.close()

            return output_path

        except Exception as e:
            print(f"Failed to trim video: {e}")
            return None

    def resize_video(self, video_path, target_resolution='1080p', output_path=None):
        """
        Resize video to target resolution

        Args:
            video_path (str): Input video path
            target_resolution (str): '720p', '1080p', or '4k'
            output_path (str): Output file path

        Returns:
            str: Path to resized video
        """
        try:
            from moviepy.editor import VideoFileClip

            resolutions = {
                '720p': (1280, 720),
                '1080p': (1920, 1080),
                '4k': (3840, 2160),
            }

            target_size = resolutions.get(target_resolution, (1920, 1080))

            clip = VideoFileClip(video_path)
            resized = clip.resize(newsize=target_size)

            if not output_path:
                output_path = video_path.replace('.mp4', f'_{target_resolution}.mp4')

            resized.write_videofile(output_path, codec='libx264', logger=None)

            clip.close()
            resized.close()

            return output_path

        except Exception as e:
            print(f"Failed to resize video: {e}")
            return None

    def speed_change(self, video_path, speed_factor=1.5, output_path=None):
        """
        Change video playback speed

        Args:
            video_path (str): Input video path
            speed_factor (float): Speed multiplier (0.5 = half speed, 2.0 = double speed)
            output_path (str): Output file path

        Returns:
            str: Path to speed-changed video
        """
        try:
            from moviepy.editor import VideoFileClip

            clip = VideoFileClip(video_path)
            sped_up = clip.fx(lambda c: c.speedx(speed_factor))

            if not output_path:
                output_path = video_path.replace('.mp4', f'_speed_{speed_factor}x.mp4')

            sped_up.write_videofile(output_path, codec='libx264', logger=None)

            clip.close()
            sped_up.close()

            return output_path

        except Exception as e:
            print(f"Failed to change speed: {e}")
            return None
