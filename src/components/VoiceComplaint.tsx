"use client";

import { useRef, useState } from "react";
import { VOICE_LANGUAGES } from "@/lib/utils";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function VoiceComplaint({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [language, setLanguage] = useState("en-US");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = () => {
    const SpeechRecognitionCtor =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("Voice typing is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ");
      onChange(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setError("Microphone permission was denied.");
      } else if (event.error === "network") {
        setError("Network error while recognizing speech. Check your connection.");
      } else {
        setError("Voice typing stopped. You can type the complaint instead.");
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="voice-block">
      <div className="section-toolbar">
        <h3>Patient&apos;s Complaint</h3>
        <select
          aria-label="Voice language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {VOICE_LANGUAGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={listening ? stop : start}>
          {listening ? "Stop mic" : "Start mic"}
        </button>
      </div>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type or dictate the patient's complaint"
      />
      {error && <p className="onboarding-message">{error}</p>}
    </div>
  );
}
