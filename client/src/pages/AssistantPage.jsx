// AssistantPage - voice + typed command interface (Phase 6).

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Send, Volume2, Keyboard } from 'lucide-react';
import { Card, Button, Input, Loader } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { assistantService, taskService } from '../services/domain.services';
import { useSpeechRecognition, useSpeechSynthesis } from '../hooks/useSpeech';
import { useToast } from '../context/ToastContext';
import { formatBusiness } from '../utils/format';

export function AssistantPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null); // { action, taskId, confirmToken, message }
  const [voiceOut, setVoiceOut] = useState(true);

  const speech = useSpeechRecognition({
    onResult: (transcript) => handleCommand(transcript),
    onError: (err) => showToast(`Speech error: ${err}`, 'error'),
  });
  const synth = useSpeechSynthesis({ rate: 1, pitch: 1 });

  const capabilities = useQuery({ queryKey: ['assistant-capabilities'], queryFn: assistantService.capabilities });

  const say = (text) => {
    if (voiceOut) synth.speak(text);
  };

  const handleCommand = async (text) => {
    if (!text?.trim() || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text, at: new Date() }]);
    try {
      const res = await assistantService.query(text.trim());
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, data: res, at: new Date() }]);
      say(res.answer);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: err.message, at: new Date() }]);
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const completeTaskById = async (taskId) => {
    setBusy(true);
    try {
      const prep = await assistantService.prepareAction('COMPLETE_TASK', taskId);
      setPendingConfirm(prep);
      say(prep.message);
      setMessages((m) => [...m, { role: 'assistant', text: prep.message, at: new Date() }]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingConfirm) return;
    setBusy(true);
    try {
      const res = await assistantService.executeAction(pendingConfirm.action, pendingConfirm.task.id, pendingConfirm.confirmToken);
      setMessages((m) => [...m, { role: 'assistant', text: res.message, at: new Date() }]);
      say(res.message);
      showToast(res.message);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
      setPendingConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voice Assistant"
        subtitle="Ask about your day — speech optional, typed always available"
        actions={(
          <Button variant="secondary" onClick={() => setVoiceOut((v) => !v)}>
            <Volume2 size={15} /> {voiceOut ? 'Voice on' : 'Voice off'}
          </Button>
        )}
      />

      {/* Capability help */}
      {capabilities.data && (
        <Card className="px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Try asking</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['What is my work today?', 'What meetings does Dr. Singh have today?', 'What is my next meeting?', 'What tasks are overdue?', 'Who do I need to follow up with?', 'Give me my briefing'].map((s) => (
              <button key={s} onClick={() => handleCommand(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-primary-300 hover:text-primary-800">
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Conversation */}
      <Card className="flex min-h-64 flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!messages.length && (
            <p className="py-8 text-center text-sm text-slate-400">
              {speech.supported ? 'Press the microphone or type a command below.' : 'Speech recognition is not available in this browser — typed commands work everywhere.'}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.data?.data?.events?.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {m.data.data.events.slice(0, 5).map((ev, j) => (
                      <li key={j} className="text-xs opacity-80">{ev.subject || 'Meeting'} · {formatBusiness(ev.startAt, 'h:mm a')}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {busy && <Loader />}
        </div>

        {/* Pending confirmation */}
        {pendingConfirm && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">{pendingConfirm.message}</p>
            <div className="mt-2 flex gap-2">
              <Button onClick={confirmAction} loading={busy}>Yes, confirm</Button>
              <Button variant="secondary" onClick={() => setPendingConfirm(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2 border-t border-slate-100 p-3">
          {speech.supported ? (
            <Button
              variant={speech.listening ? 'accent' : 'secondary'}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
            >
              {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
              {speech.listening ? 'Listening…' : 'Speak'}
            </Button>
          ) : (
            <Button variant="secondary" disabled title="Speech recognition unavailable">
              <Keyboard size={16} /> Type only
            </Button>
          )}
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => { e.preventDefault(); const t = typed; setTyped(''); handleCommand(t); }}
          >
            <Input placeholder="Type a command…" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <Button type="submit" disabled={!typed.trim() || busy} aria-label="Send"><Send size={15} /></Button>
          </form>
        </div>
      </Card>

      {/* Task completion by id helper */}
      <Card className="px-4 py-3">
        <p className="text-xs font-medium text-slate-500">Quick action</p>
        <div className="mt-2 flex gap-2">
          <Input placeholder="Paste task id to mark complete…" value={typed.startsWith('complete ') ? typed : ''} onChange={(e) => setTyped(`complete ${e.target.value}`)} />
          <Button variant="accent" onClick={() => completeTaskById(typed.replace('complete ', '').trim())} disabled={busy || typed.replace('complete ', '').trim().length < 6}>
            Complete
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">State-changing actions always require explicit confirmation.</p>
      </Card>
    </div>
  );
}
