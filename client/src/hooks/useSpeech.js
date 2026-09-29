// useSpeech - browser speech recognition/synthesis wrappers with feature detection.

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechRecognition({ onResult, onError } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const callbacksRef = useRef({ onResult, onError });
  callbacksRef.current = { onResult, onError };

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    setSupported(true);

    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript && callbacksRef.current.onResult) callbacksRef.current.onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (event) => {
      setListening(false);
      if (callbacksRef.current.onError) callbacksRef.current.onError(event.error);
    };

    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch { /* noop */ } };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch { /* already started */ }
  }, [listening]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}

export function useSpeechSynthesis({ rate = 1, pitch = 1 } = {}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.min(Math.max(rate, 0.5), 2);
    utterance.pitch = Math.min(Math.max(pitch, 0.5), 2);
    utterance.lang = 'en-IN';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [rate, pitch]);

  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}
