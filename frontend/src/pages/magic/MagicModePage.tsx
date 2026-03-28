import { useCallback } from 'react';
import { useMagicModeStore } from '../../store/magicModeStore';
import { URLInputScreen } from './URLInputScreen';
import { AIQuestionsScreen } from './AIQuestionsScreen';
import { AIWorkingScreen } from './AIWorkingScreen';
import { ResultsScreen } from './ResultsScreen';

export function MagicModePage() {
  const { screen, setScreen, setUrl, setAnswer } = useMagicModeStore();

  const handleURLSubmit = useCallback((url: string) => {
    setUrl(url);
    setScreen('questions');
  }, [setUrl, setScreen]);

  const handleURLSkip = useCallback(() => {
    setUrl('');
    setScreen('questions');
  }, [setUrl, setScreen]);

  const handleQuestionsComplete = useCallback((answers: Record<string, string | string[]>) => {
    Object.entries(answers).forEach(([key, val]) => setAnswer(key, val));
    setScreen('working');
  }, [setAnswer, setScreen]);

  const handleQuestionsBack = useCallback(() => {
    setScreen('url');
  }, [setScreen]);

  const handleWorkingComplete = useCallback(() => {
    setScreen('results');
  }, [setScreen]);

  const handleGenerateMore = useCallback(() => {
    // Clear old posts so AIWorkingScreen generates fresh ones
    useMagicModeStore.getState().setGeneratedPosts([]);
    setScreen('working');
  }, [setScreen]);

  switch (screen) {
    case 'url':
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} />;
    case 'questions':
      return <AIQuestionsScreen onComplete={handleQuestionsComplete} onBack={handleQuestionsBack} />;
    case 'working':
      return <AIWorkingScreen onComplete={handleWorkingComplete} />;
    case 'results':
      return <ResultsScreen onGenerateMore={handleGenerateMore} />;
    default:
      // 'mode' screen is handled by ModeSelectPage
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} />;
  }
}

export default MagicModePage;
