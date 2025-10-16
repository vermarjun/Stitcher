import { useEffect, useState, useRef } from "react";

interface LiveTextStreamProps {
  text: string;
  streamingSpeed?: number; // milliseconds between words
  onStreamingComplete?: () => void;
}

const LiveTextStream = ({ 
  text, 
  streamingSpeed = 50,
  onStreamingComplete 
}: LiveTextStreamProps) => {
  const [displayedText, setDisplayedText] = useState<string[]>([]);
  const [, setIsStreaming] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Split text into words for streaming effect
  const words = text.split(' ');

  useEffect(() => {
    if (!text) return;

    setIsStreaming(true);
    setDisplayedText([]);

    let currentIndex = 0;

    const streamInterval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(prev => [...prev, words[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
        onStreamingComplete?.();
      }
    }, streamingSpeed);

    return () => {
      clearInterval(streamInterval);
    };
  }, [text, streamingSpeed, onStreamingComplete]);

  // Auto-scroll to bottom as new text comes in
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayedText]);

  return (
    <div 
      ref={textContainerRef}
      className="bg-transparent text-sm text-zinc-400 leading-relaxed overflow-y-auto"
    >
      {/* Display words with proper spacing */}
      {displayedText.map((word, index) => (
        <span key={index} className="inline">
          {word}{' '}
        </span>
      ))}
    </div>
  );
};

export default LiveTextStream