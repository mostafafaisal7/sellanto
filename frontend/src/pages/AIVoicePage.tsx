import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  SpeakerWaveIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card, Input, Textarea, Spinner } from '../components/ui';
import { DiamondCostIndicator } from '../components/diamond';
import voiceService from '../services/voiceService';
import { toast } from '../store/toastStore';
import type { VoiceGeneration, UserVoiceSettings } from '../services/voiceService';

// Voice options
const voices = [
  { id: 'alloy', label: 'Alloy', description: 'Neutral' },
  { id: 'echo', label: 'Echo', description: 'Male' },
  { id: 'fable', label: 'Fable', description: 'British' },
  { id: 'onyx', label: 'Onyx', description: 'Deep Male' },
  { id: 'nova', label: 'Nova', description: 'Female' },
  { id: 'shimmer', label: 'Shimmer', description: 'Soft Female' },
];

// Model options
const models = [
  { id: 'tts-1', label: 'TTS-1', description: 'Standard - Faster' },
  { id: 'tts-1-hd', label: 'TTS-1-HD', description: 'High Quality' },
];

// Format options
const formats = [
  { id: 'mp3', label: 'MP3' },
  { id: 'opus', label: 'Opus' },
  { id: 'aac', label: 'AAC' },
  { id: 'flac', label: 'FLAC' },
  { id: 'wav', label: 'WAV' },
];

type TabType = 'generate' | 'history' | 'settings';

export function AIVoicePage() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<VoiceGeneration | null>(null);
  const [history, setHistory] = useState<VoiceGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [selectedModel, setSelectedModel] = useState('tts-1');
  const [speed, setSpeed] = useState(1.0);
  const [selectedFormat, setSelectedFormat] = useState('mp3');

  // Settings state
  const [settings, setSettings] = useState<UserVoiceSettings | null>(null);
  const [defaultVoice, setDefaultVoice] = useState('alloy');
  const [defaultSpeed, setDefaultSpeed] = useState(1.0);
  const [defaultModel, setDefaultModel] = useState('tts-1');

  // Audio player state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await voiceService.getHistory();
      setHistory(Array.isArray(data) ? data : (data as unknown as { results: VoiceGeneration[] }).results || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await voiceService.getSettings();
      setSettings(data);
      setDefaultVoice(data.default_voice || 'alloy');
      setDefaultSpeed(data.default_speed || 1.0);
      setDefaultModel(data.default_model || 'tts-1');
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setError('');
    setGeneratedAudio(null);

    try {
      const result = await voiceService.generate({
        text: text.trim(),
        title: title || undefined,
        voice: selectedVoice,
        model: selectedModel,
        speed,
        format: selectedFormat,
      });
      setGeneratedAudio(result);
      toast.success('Voice generated successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      // Try to extract error from response
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (!text.trim()) return;
    setPreviewPlaying(true);
    try {
      const result = await voiceService.preview({
        text: text.trim().slice(0, 100),
        voice: selectedVoice,
        speed,
      });
      if (result.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${result.audio_base64}`);
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewPlaying(false);
        audio.play();
      }
    } catch (err) {
      console.error('Preview failed:', err);
      setPreviewPlaying(false);
    }
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewPlaying(false);
  };

  const playAudio = (url: string, id: number) => {
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play();
    setPlayingId(id);
  };

  const handleDelete = async (id: number) => {
    try {
      await voiceService.deleteGeneration(id);
      setHistory((prev) => prev.filter((g) => g.id !== id));
      if (generatedAudio?.id === id) setGeneratedAudio(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRegenerate = async (id: number) => {
    setIsGenerating(true);
    setError('');
    try {
      const result = await voiceService.regenerate(id);
      setGeneratedAudio(result);
      setActiveTab('generate');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || 'Regeneration failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSettings = async () => {
    try {
      await voiceService.updateSettings({
        default_voice: defaultVoice,
        default_speed: defaultSpeed,
        default_model: defaultModel,
      });
      fetchSettings();
      toast.success('Settings saved!');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const downloadAudio = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (s: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processing' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    };
    const { bg, text: textClass, label } = config[s] || config.pending;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${textClass}`}>{label}</span>;
  };

  const getVoiceLabel = (voiceId: string) => {
    const v = voices.find((x) => x.id === voiceId);
    return v ? `${v.label} (${v.description})` : voiceId;
  };

  const tabs: { id: TabType; label: string; Icon: typeof SpeakerWaveIcon }[] = [
    { id: 'generate', label: 'Generate', Icon: SparklesIcon },
    { id: 'history', label: 'History', Icon: ClockIcon },
    { id: 'settings', label: 'Settings', Icon: Cog6ToothIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <SpeakerWaveIcon className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Voice Generator</h1>
          <p className="text-text-secondary">Convert text to speech with OpenAI TTS</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                : 'bg-dark-700 text-text-secondary hover:text-text-primary hover:bg-dark-600'
            }`}
          >
            <tab.Icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Text */}
            <Card>
              <div className="space-y-4">
                <Input
                  label="Title (optional)"
                  placeholder="Give your audio a name..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      Text <span className="text-danger">*</span>
                    </label>
                    <span className="text-xs text-text-muted">{text.length} / 4096</span>
                  </div>
                  <Textarea
                    placeholder="Enter the text you want to convert to speech..."
                    rows={6}
                    value={text}
                    onChange={(e) => {
                      if (e.target.value.length <= 4096) setText(e.target.value);
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* Voice Selection */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <SpeakerWaveIcon className="w-5 h-5 text-violet-400" />
                <h3 className="font-semibold text-text-primary">Voice</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {voices.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedVoice === voice.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="font-medium text-text-primary">{voice.label}</p>
                    <p className="text-xs text-text-muted mt-1">{voice.description}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Model & Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Model</h3>
                <div className="space-y-2">
                  {models.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        selectedModel === m.id
                          ? 'bg-violet-500/10 border border-violet-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="model"
                          checked={selectedModel === m.id}
                          onChange={() => setSelectedModel(m.id)}
                          className="w-4 h-4 text-violet-500 bg-dark-600 border-white/20"
                        />
                        <span className="text-sm text-text-primary">{m.label}</span>
                      </div>
                      <span className="text-xs text-text-muted">{m.description}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-text-primary mb-3">Output Format</h3>
                <div className="space-y-2">
                  {formats.map((f) => (
                    <label
                      key={f.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedFormat === f.id
                          ? 'bg-violet-500/10 border border-violet-500/30'
                          : 'bg-dark-700/50 border border-transparent hover:bg-dark-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        checked={selectedFormat === f.id}
                        onChange={() => setSelectedFormat(f.id)}
                        className="w-4 h-4 text-violet-500 bg-dark-600 border-white/20"
                      />
                      <span className="text-sm text-text-primary">{f.label}</span>
                    </label>
                  ))}
                </div>
              </Card>
            </div>

            {/* Speed */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary">Speed</h3>
                <span className="text-sm text-violet-400 font-medium">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-text-muted mt-2">
                <span>0.25x (Slow)</span>
                <span>1.0x (Normal)</span>
                <span>4.0x (Fast)</span>
              </div>
            </Card>

            {/* Preview & Generate Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={previewPlaying ? stopPreview : handlePreview}
                disabled={!text.trim() || isGenerating}
                leftIcon={previewPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
              >
                {previewPlaying ? 'Stop Preview' : 'Preview (100 chars)'}
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={handleGenerate}
                isLoading={isGenerating}
                disabled={!text.trim()}
                leftIcon={<SparklesIcon className="w-5 h-5" />}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                Generate Voice <DiamondCostIndicator cost={5} className="ml-2" />
              </Button>
            </div>
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Generated Audio</h3>
                {generatedAudio?.audio_file && (
                  <button
                    onClick={() => downloadAudio(generatedAudio.audio_file!, `${generatedAudio.title || 'voice'}.${generatedAudio.output_format}`)}
                    className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5 text-text-muted" />
                  </button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Spinner size="lg" />
                  <p className="mt-4 text-text-secondary">Generating audio...</p>
                  <p className="text-xs text-text-muted mt-2">This may take a few seconds</p>
                </div>
              ) : generatedAudio?.audio_file ? (
                <div className="space-y-4">
                  {/* Audio Player */}
                  <div className="p-6 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-xl border border-violet-500/20">
                    <div className="flex items-center justify-center mb-4">
                      <button
                        onClick={() => playAudio(generatedAudio.audio_file!, generatedAudio.id)}
                        className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all"
                      >
                        {playingId === generatedAudio.id ? (
                          <PauseIcon className="w-8 h-8 text-white" />
                        ) : (
                          <PlayIcon className="w-8 h-8 text-white ml-1" />
                        )}
                      </button>
                    </div>
                    <audio
                      src={generatedAudio.audio_file}
                      controls
                      className="w-full"
                    />
                  </div>

                  {/* Audio Info */}
                  <div className="space-y-2">
                    <p className="font-medium text-text-primary">{generatedAudio.title}</p>
                    <p className="text-sm text-text-muted line-clamp-3">{generatedAudio.input_text}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                    <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                      <p className="text-sm font-bold text-text-primary">{getVoiceLabel(generatedAudio.voice)}</p>
                      <p className="text-xs text-text-muted">Voice</p>
                    </div>
                    <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                      <p className="text-sm font-bold text-text-primary">{generatedAudio.speed}x</p>
                      <p className="text-xs text-text-muted">Speed</p>
                    </div>
                    <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                      <p className="text-sm font-bold text-text-primary">{generatedAudio.characters_used}</p>
                      <p className="text-xs text-text-muted">Characters</p>
                    </div>
                    <div className="p-3 bg-dark-700/50 rounded-xl text-center">
                      <p className="text-sm font-bold text-text-primary">{formatFileSize(generatedAudio.file_size_bytes)}</p>
                      <p className="text-xs text-text-muted">File Size</p>
                    </div>
                  </div>

                  {generatedAudio.processing_time && (
                    <p className="text-xs text-text-muted text-center">
                      Generated in {generatedAudio.processing_time.toFixed(2)}s
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 text-center pt-1">
                    Powered by OpenAI{generatedAudio.model ? ` · ${generatedAudio.model.toUpperCase()}` : ''}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center mb-4">
                    <SpeakerWaveIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text-secondary">Your generated audio will appear here</p>
                  <p className="text-xs text-text-muted mt-2">Enter text and click Generate</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : history.length === 0 ? (
            <Card padding="lg" className="text-center">
              <ClockIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No History Yet</h3>
              <p className="text-text-secondary">Generated audio files will appear here</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card padding="sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary">{history.length}</p>
                    <p className="text-xs text-text-muted">Total Generations</p>
                  </div>
                </Card>
                <Card padding="sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{history.filter(g => g.status === 'completed').length}</p>
                    <p className="text-xs text-text-muted">Completed</p>
                  </div>
                </Card>
                <Card padding="sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-violet-400">
                      {history.reduce((sum, g) => sum + g.characters_used, 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted">Characters Used</p>
                  </div>
                </Card>
              </div>

              {/* History items */}
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="hover:border-white/20 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Play button */}
                      <button
                        onClick={() => item.audio_file && playAudio(item.audio_file, item.id)}
                        disabled={!item.audio_file}
                        className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${
                          item.audio_file
                            ? playingId === item.id
                              ? 'bg-violet-500 shadow-lg shadow-violet-500/30'
                              : 'bg-violet-500/20 hover:bg-violet-500/30'
                            : 'bg-dark-600 cursor-not-allowed'
                        }`}
                      >
                        {playingId === item.id ? (
                          <PauseIcon className="w-5 h-5 text-white" />
                        ) : (
                          <PlayIcon className="w-5 h-5 text-violet-400" />
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-text-primary truncate">{item.title}</p>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-sm text-text-muted line-clamp-2 mb-2">{item.input_text}</p>
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <span>{getVoiceLabel(item.voice)}</span>
                          <span>{item.speed}x</span>
                          <span>{item.characters_used} chars</span>
                          <span>{formatFileSize(item.file_size_bytes)}</span>
                          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                          <span className="text-slate-500">OpenAI{item.model ? ` · ${item.model.toUpperCase()}` : ''}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.audio_file && (
                          <button
                            onClick={() => downloadAudio(item.audio_file!, `${item.title}.${item.output_format}`)}
                            className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                            title="Download"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4 text-text-muted" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRegenerate(item.id)}
                          className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
                          title="Regenerate"
                        >
                          <ArrowPathIcon className="w-4 h-4 text-text-muted" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4 text-text-muted hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          {/* Info: API keys managed by admin */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">AI Service Active</h3>
                <p className="text-sm text-text-secondary">API keys are managed by your administrator</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              All AI features are powered by Diamond Tokens. Contact your admin for API configuration.
            </p>
          </Card>

          {/* Defaults */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-6">Default Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Default Voice</label>
                <select
                  value={defaultVoice}
                  onChange={(e) => setDefaultVoice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-text-primary focus:border-violet-500 focus:outline-none"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>{v.label} - {v.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Default Model</label>
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-text-primary focus:border-violet-500 focus:outline-none"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label} - {m.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Default Speed</label>
                  <span className="text-sm text-violet-400 font-medium">{defaultSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="4.0"
                  step="0.05"
                  value={defaultSpeed}
                  onChange={(e) => setDefaultSpeed(parseFloat(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
            </div>
          </Card>

          {/* Usage Stats */}
          {settings && (
            <Card>
              <h3 className="text-lg font-semibold text-text-primary mb-4">Usage Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-violet-400">{settings.total_generations}</p>
                  <p className="text-sm text-text-muted">Total Generations</p>
                </div>
                <div className="p-4 bg-dark-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-400">{settings.total_characters_used.toLocaleString()}</p>
                  <p className="text-sm text-text-muted">Characters Used</p>
                </div>
              </div>
            </Card>
          )}

          {/* Save button */}
          <div className="pt-4 border-t border-white/5">
            <Button
              onClick={saveSettings}
              leftIcon={<CheckCircleIcon className="w-5 h-5" />}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIVoicePage;
