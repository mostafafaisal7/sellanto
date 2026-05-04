import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore } from '../../store/magicModeStore';
import { postService } from '../../services/postService';
import ConnectAccountModal from '../../components/ConnectAccountModal';
import type { PlatformType } from '../../types';

const platformEmojiMap: Record<string, string> = {
  LinkedIn: '💼', Instagram: '📸', Facebook: '📘', 'Twitter / X': '🐦', TikTok: '🎵',
};

interface VideoResultScreenProps {
  onBack: () => void;
  onGenerateAnother: () => void;
}

export function VideoResultScreen({ onBack, onGenerateAnother }: VideoResultScreenProps) {
  const navigate = useNavigate();
  const { videoResult, answers } = useMagicModeStore();

  const videoUrl = videoResult?.videoUrl ?? '';
  const prompt = videoResult?.prompt ?? '';

  const selectedPlatforms: string[] = Array.isArray(answers.platforms)
    ? (answers.platforms as string[])
    : answers.platforms ? [answers.platforms as string] : ['LinkedIn'];

  const [caption, setCaption] = useState(
    `🎬 ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}`
  );
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState(caption);

  const [status, setStatus] = useState<'idle' | 'posting' | 'scheduling' | 'done'>('idle');
  const [postError, setPostError] = useState<string | null>(null);
  const [connectModalError, setConnectModalError] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [finalStatus, setFinalStatus] = useState<'published' | 'scheduled' | null>(null);

  const downloadVideoAsFile = async (): Promise<File[]> => {
    if (!videoUrl) return [];
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      return [new File([blob], 'generated-video.mp4', { type: blob.type || 'video/mp4' })];
    } catch {
      return [];
    }
  };

  const publishPlatforms = selectedPlatforms.map(
    (p) => p.toLowerCase().replace(' / x', '') as PlatformType
  );

  const handlePost = async () => {
    setStatus('posting');
    setPostError(null);
    try {
      const mediaFiles = await downloadVideoAsFile();
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      await postService.create({
        caption,
        media_files: mediaFiles,
        platforms: publishPlatforms,
        source: 'magic',
        hook: prompt.slice(0, 60),
        scheduled_time: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setFinalStatus('published');
      setStatus('done');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to post.';
      if (msg.toLowerCase().includes('no connected account')) {
        setConnectModalError(msg);
      } else {
        setPostError(msg);
      }
      setStatus('idle');
    }
  };

  const handleSchedule = async () => {
    if (!schedDate || !schedTime) return;
    setStatus('scheduling');
    setPostError(null);
    try {
      const mediaFiles = await downloadVideoAsFile();
      const scheduledTime = new Date(`${schedDate}T${schedTime}`).toISOString();
      await postService.create({
        caption,
        media_files: mediaFiles,
        platforms: publishPlatforms,
        source: 'magic',
        hook: prompt.slice(0, 60),
        scheduled_time: scheduledTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setFinalStatus('scheduled');
      setStatus('done');
      setShowScheduler(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to schedule.';
      if (msg.toLowerCase().includes('no connected account')) {
        setConnectModalError(msg);
      } else {
        setPostError(msg);
      }
      setStatus('idle');
    }
  };

  if (status === 'done' && finalStatus) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'rgb(var(--c-bg-primary))' }}
      >
        <div
          className="w-full max-w-[480px] rounded-[24px] p-8 text-center scale-in"
          style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
        >
          <div className="text-[52px] mb-4">{finalStatus === 'published' ? '🚀' : '📅'}</div>
          <h2 className="text-[26px] font-extrabold text-text-primary mb-2">
            {finalStatus === 'published' ? 'Video posted!' : 'Video scheduled!'}
          </h2>
          <p className="text-[15px] text-text-secondary mb-8">
            {finalStatus === 'published'
              ? 'Your video is on its way to your platforms.'
              : `Scheduled for ${new Date(`${schedDate}T${schedTime}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onGenerateAnother}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))', boxShadow: 'var(--shadow-glow-coral)' }}
            >
              🎬 Generate another video
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Header */}
      <div className="w-full max-w-[680px] mx-auto mb-6">
        <div className="flex items-center gap-3">
          <span className="text-[36px]">🎬</span>
          <div>
            <h1 className="text-[26px] font-extrabold text-text-primary" style={{ letterSpacing: '-0.3px' }}>
              Your video is ready!
            </h1>
            <p className="text-[14px] text-text-secondary">Review, edit caption, then post or schedule.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-[680px] mx-auto w-full gap-5">
        {/* Video player */}
        <div
          className="rounded-[18px] overflow-hidden"
          style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)' }}
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full"
            style={{ maxHeight: 420, background: '#000' }}
          />
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[13px] text-text-muted truncate max-w-[70%]">{prompt}</p>
            <a
              href={videoUrl}
              download="generated-video.mp4"
              className="text-[13px] font-semibold px-3 py-1.5 rounded-[8px]"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
            >
              ⬇ Download
            </a>
          </div>
        </div>

        {/* Platforms */}
        <div>
          <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">Posting to</p>
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 rounded-full text-[13px] font-semibold"
                style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
              >
                {platformEmojiMap[p] || '📱'} {p}
              </span>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">Caption</p>
            {!editingCaption && (
              <button
                onClick={() => { setDraftCaption(caption); setEditingCaption(true); }}
                className="text-[12px] font-semibold px-3 py-1 rounded-[8px]"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {editingCaption ? (
            <div>
              <textarea
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                rows={4}
                className="w-full text-[14px] resize-none"
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1.5px solid rgba(232,54,79,0.3)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgb(var(--c-text-primary))',
                  outline: 'none',
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setCaption(draftCaption); setEditingCaption(false); }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCaption(false)}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-[12px] px-4 py-3 text-[14px] text-text-secondary leading-relaxed whitespace-pre-line"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}
            >
              {caption}
            </div>
          )}
        </div>

        {/* Error */}
        {postError && (
          <div
            className="rounded-[10px] px-4 py-3 text-[13px]"
            style={{ background: 'rgba(232,54,79,0.08)', border: '1px solid rgba(232,54,79,0.2)', color: 'rgb(var(--c-coral))' }}
          >
            {postError}
          </div>
        )}

        {/* Scheduler */}
        {showScheduler && (
          <div
            className="rounded-[14px] px-5 py-4 flex flex-wrap items-center gap-3"
            style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}
          >
            <input
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-[13px] px-3 py-2 rounded-[10px] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            />
            <input
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
              className="text-[13px] px-3 py-2 rounded-[10px] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            />
            <button
              onClick={handleSchedule}
              disabled={!schedDate || !schedTime || status === 'scheduling'}
              className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))',
                opacity: !schedDate || !schedTime || status === 'scheduling' ? 0.5 : 1,
              }}
            >
              {status === 'scheduling' ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
            <button
              onClick={() => setShowScheduler(false)}
              className="text-[13px] font-semibold"
              style={{ color: 'rgb(var(--c-text-muted))' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            disabled={status === 'posting' || status === 'scheduling'}
            className="flex-1 py-3.5 rounded-[14px] text-[15px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          >
            📅 Schedule
          </button>
          <button
            onClick={handlePost}
            disabled={status === 'posting' || status === 'scheduling'}
            className="flex-1 py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
              boxShadow: 'var(--shadow-glow-coral)',
              opacity: status === 'posting' ? 0.7 : 1,
            }}
          >
            {status === 'posting' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Posting…
              </span>
            ) : '🚀 Post Now'}
          </button>
        </div>

        <button
          onClick={onGenerateAnother}
          className="text-[13px] font-semibold text-center py-2"
          style={{ color: 'rgb(var(--c-coral))' }}
        >
          + Generate another video
        </button>
      </div>

      {/* Back */}
      <div className="w-full max-w-[680px] mx-auto pt-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>

      <ConnectAccountModal
        open={!!connectModalError}
        message={connectModalError || ''}
        onClose={() => setConnectModalError(null)}
      />
    </div>
  );
}

export default VideoResultScreen;
