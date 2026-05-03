'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Volume2, Globe } from 'lucide-react';

export default function AudioDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // We'll use a placeholder audio file path for now since we don't have the actual recording
  const AUDIO_SRC = "/placeholder-demo.mp3"; 

  const togglePlay = () => {
    if (!audioRef.current) {
      // Create audio instance on first play to avoid autoplay block issues
      const audio = new Audio(AUDIO_SRC);
      audio.addEventListener('timeupdate', () => {
        setProgress((audio.currentTime / audio.duration) * 100);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
      });
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Audio play failed (needs real file)', e));
      // Simulate progress if the file doesn't exist
      if (!audioRef.current.duration || isNaN(audioRef.current.duration)) {
          simulateProgress();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const simulateProgress = () => {
      let curr = progress;
      const interval = setInterval(() => {
          curr += 1;
          setProgress(curr);
          if (curr >= 100 || !isPlaying) clearInterval(interval);
      }, 300);
      setTimeout(() => { clearInterval(interval); setIsPlaying(false); setProgress(0); }, 30000);
  };

  return (
    <section id="audio-demo" className="section section-border">
      <div className="container" style={{ maxWidth: '900px' }}>
        <div className="section-head">
          <span className="section-eyebrow" style={{ color: 'var(--accent)' }}>Live Demo</span>
          <h2 className="section-h2">Hear It In Action</h2>
          <p className="section-sub">Listen to Priya, our AI receptionist, seamlessly handle a booking in Telugu and English.</p>
        </div>

        <div className="card" style={{ padding: '40px', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(8,145,178,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 1 }}>
            
            {/* Visualizer / Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-card2)', border: '2px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isPlaying ? '0 0 40px rgba(8,145,178,0.4)' : 'none', transition: 'all 0.3s' }}>
                <Volume2 size={48} color={isPlaying ? "var(--accent)" : "var(--text3)"} />
              </div>
              {/* Fake sound waves */}
              {isPlaying && (
                <>
                  <div style={{ position: 'absolute', inset: -20, border: '2px solid var(--accent)', borderRadius: '50%', opacity: 0, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                  <div style={{ position: 'absolute', inset: -40, border: '2px solid var(--accent)', borderRadius: '50%', opacity: 0, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.5s' }} />
                </>
              )}
            </div>

            {/* Controls */}
            <div style={{ width: '100%', maxWidth: '500px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--bg-border)', borderRadius: '20px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                <button 
                  onClick={togglePlay}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px var(--accent-glow)', flexShrink: 0 }}
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />}
                </button>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Patient Booking Call</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(8,145,178,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                      <Globe size={12} /> Telugu + English
                    </span>
                  </div>
                  
                  <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '10px', transition: 'width 0.1s linear' }} />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text2)', fontStyle: 'italic', textAlign: 'center', lineHeight: '1.6' }}>
                "Namaskaram! Sunrise Clinic ki swagatham. Nenu Priya, AI receptionist ni. Eeroju nenu meeku ela sahaya padagalanu?"
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
